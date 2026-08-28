import { NextRequest, NextResponse } from "next/server";

import { supabase } from "@/lib/supabase";
import { scoreTransaction } from "@/lib/risk";
import { getCustomerHistory } from "@/lib/customer-history";

import {
  razorpay,
  razorpayKeyId,
} from "@/lib/razorpay";

import {
  acquireLock,
  completeIdempotencyRecord,
  createIdempotencyRecord,
  getIdempotencyRecord,
  releaseLock,
} from "@/lib/idempotency";


export async function POST(
  request: NextRequest
) {
  let idempotencyKey: string | null = null;
  let lockToken: string | null = null;

  try {

    // =====================================================
    // 1. IDEMPOTENCY KEY
    // =====================================================

    idempotencyKey =
      request.headers.get(
        "Idempotency-Key"
      );

    if (!idempotencyKey) {

      return NextResponse.json(
        {
          success: false,
          message:
            "Idempotency-Key is required",
        },
        { status: 400 }
      );
    }


    // =====================================================
    // 2. REQUEST BODY
    // =====================================================

    const body =
      await request.json();

    const {
      customer_id,
      amount,
      currency,
      description,
      payment_method,
      retry_count = 0,
    } = body;


    // =====================================================
    // 3. VALIDATION
    // =====================================================

    if (!customer_id) {

      return NextResponse.json(
        {
          success: false,
          message:
            "customer_id is required",
        },
        { status: 400 }
      );
    }

    if (
      typeof amount !== "number" ||
      amount <= 0
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "amount must be a number greater than 0",
        },
        { status: 400 }
      );
    }

    if (!currency) {

      return NextResponse.json(
        {
          success: false,
          message:
            "currency is required",
        },
        { status: 400 }
      );
    }

    if (!payment_method) {

      return NextResponse.json(
        {
          success: false,
          message:
            "payment_method is required",
        },
        { status: 400 }
      );
    }


    // =====================================================
    // 4. ACQUIRE IDEMPOTENCY LOCK
    // =====================================================

    lockToken =
      await acquireLock(
        idempotencyKey
      );

    if (!lockToken) {

      const existing =
        await getIdempotencyRecord(
          idempotencyKey
        );

      if (
        existing &&
        existing.status === "COMPLETED"
      ) {

        return NextResponse.json({
          ...existing.response,
          reused: true,
        });
      }

      return NextResponse.json(
        {
          success: false,
          message:
            "This payment request is already being processed",
        },
        { status: 409 }
      );
    }


    // =====================================================
    // 5. CHECK EXISTING IDEMPOTENCY RECORD
    // =====================================================

    const existing =
      await getIdempotencyRecord(
        idempotencyKey
      );

    if (
      existing &&
      existing.status === "COMPLETED"
    ) {

      await releaseLock(
        idempotencyKey,
        lockToken
      );

      lockToken = null;

      return NextResponse.json({
        ...existing.response,
        reused: true,
      });
    }

    if (
      existing &&
      existing.status === "PROCESSING"
    ) {

      await releaseLock(
        idempotencyKey,
        lockToken
      );

      lockToken = null;

      return NextResponse.json(
        {
          success: false,
          message:
            "This payment request is already being processed",
        },
        { status: 409 }
      );
    }


    // =====================================================
    // 6. CREATE IDEMPOTENCY RECORD
    // =====================================================

    await createIdempotencyRecord(
      idempotencyKey
    );


    // =====================================================
    // 7. GET CUSTOMER HISTORY
    // =====================================================

    const customerHistory =
      await getCustomerHistory(
        supabase,
        customer_id
      );


    // =====================================================
    // 8. ML RISK SCORING
    // =====================================================

    const createdAt =
      new Date().toISOString();

    const risk =
      await scoreTransaction({

        amount:
          Number(amount),

        paymentMethod:
          payment_method,

        createdAt,

        retryCount:
          Number(retry_count || 0),

        customerHistory,
      });


    console.log(
      "Risk result:",
      risk
    );


    // // =====================================================
    // // 9. HIGH RISK → BLOCK
    // // =====================================================

    if (
      risk &&
      risk.risk_level === "HIGH"
    ) {

      await releaseLock(
        idempotencyKey,
        lockToken
      );

      lockToken = null;

      return NextResponse.json(
        {
          success: false,

          status: "HIGH_RISK",

          risk_score:
            risk.risk_score,

          risk_probability:
            risk.risk_probability,

          risk_level:
            risk.risk_level,

          risk_factors:
            risk.risk_factors,

          message:
            "Payment is risky because the transaction is classified as high risk.",
        },
        {
          status: 403,
        }
      );
    }

   


    // =====================================================
    // 10. CREATE RAZORPAY ORDER
    // =====================================================

    const razorpayOrder =
      await razorpay.orders.create({

        amount:
          Math.round(
            amount * 100
          ),

        currency:
          currency.toUpperCase(),

        receipt:
          idempotencyKey,
      });


    // =====================================================
    // 11. SAVE PAYMENT
    // =====================================================

    const {
      data: payment,
      error: paymentError,
    } =
      await supabase
        .from("payments")
        .insert({

          customer_id,

          amount,

          currency:
            currency.toUpperCase(),

          description:
            description || null,

          payment_method,

          status:
            "PENDING",

          gateway_status:
            "CREATED",

          idempotency_key:
            idempotencyKey,

          razorpay_order_id:
            razorpayOrder.id,

          // -------------------------
          // ML RISK INFORMATION
          // -------------------------

          risk_score:
            risk?.risk_score ??
            null,

          risk_level:
            risk?.risk_level ??
            null,

          risk_factors:
            risk?.risk_factors ??
            [],
        })
        .select()
        .single();


    // =====================================================
    // 12. DATABASE ERROR
    // =====================================================

    if (paymentError) {

      console.error(
        "Payment creation error:",
        paymentError
      );

      throw paymentError;
    }


    // =====================================================
    // 13. RESPONSE
    // =====================================================

    const response = {

      success: true,

      payment_id:
        payment.id,

      id:
        payment.id,

      customer_id:
        payment.customer_id,

      amount:
        Number(payment.amount),

      currency:
        payment.currency,

      description:
        payment.description,

      payment_method:
        payment.payment_method,

      status:
        payment.status,

      gateway_status:
        payment.gateway_status,

      razorpay_order_id:
        payment.razorpay_order_id,

      razorpay_key_id:
        razorpayKeyId,

      idempotency_key:
        payment.idempotency_key,

      // -------------------------
      // RISK RESPONSE
      // -------------------------

      risk_score:
        risk?.risk_score ??
        null,

      risk_probability:
        risk?.risk_probability ??
        null,

      risk_level:
        risk?.risk_level ??
        null,

      risk_factors:
        risk?.risk_factors ??
        [],

      reused: false,
    };


    // =====================================================
    // 14. COMPLETE IDEMPOTENCY RECORD
    // =====================================================

    await completeIdempotencyRecord(
      idempotencyKey,
      response
    );


    // =====================================================
    // 15. RELEASE LOCK
    // =====================================================

    await releaseLock(
      idempotencyKey,
      lockToken
    );

    lockToken = null;


    // =====================================================
    // 16. RETURN
    // =====================================================

    return NextResponse.json(
      response,
      {
        status: 200,
      }
    );

  } catch (error) {

    console.error(
      "Payment API error:",
      error
    );


    // =====================================================
    // RELEASE LOCK ON ERROR
    // =====================================================

    if (
      idempotencyKey &&
      lockToken
    ) {

      try {

        await releaseLock(
          idempotencyKey,
          lockToken
        );

      } catch (releaseError) {

        console.error(
          "Failed to release Redis lock:",
          releaseError
        );
      }
    }


    return NextResponse.json(
      {
        success: false,

        message:
          "Payment processing failed",
      },
      {
        status: 500,
      }
    );
  }
}



