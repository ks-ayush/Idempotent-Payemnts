import { NextRequest, NextResponse } from "next/server";

import { supabase } from "@/lib/supabase";
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

export async function POST(request: NextRequest) {
  let idempotencyKey: string | null = null;
  let lockToken: string | null = null;

  try {
    

    idempotencyKey =
      request.headers.get("Idempotency-Key");

    if (!idempotencyKey) {
      return NextResponse.json(
        {
          success: false,
          message: "Idempotency-Key is required",
        },
        { status: 400 }
      );
    }

    
    const body = await request.json();

    const {
      customer_id,
      amount,
      currency,
      description,
      payment_method,
    } = body;

    

    if (!customer_id) {
      return NextResponse.json(
        {
          success: false,
          message: "customer_id is required",
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
          message: "currency is required",
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

    

    lockToken =
      await acquireLock(idempotencyKey);

    

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

   

    await createIdempotencyRecord(
      idempotencyKey
    );

    

    const razorpayOrder =
      await razorpay.orders.create({
        amount: Math.round(amount * 100),
        currency: currency.toUpperCase(),
        receipt: idempotencyKey,
      });

   

    const {
      data: payment,
      error: paymentError,
    } = await supabase
      .from("payments")
      .insert({
        customer_id,

        amount,

        currency:
          currency.toUpperCase(),

        description:
          description || null,

        payment_method,

        status: "PENDING",

        gateway_status: "CREATED",

        idempotency_key:
          idempotencyKey,

        razorpay_order_id:
          razorpayOrder.id,
      })
      .select()
      .single();


    if (paymentError) {
      console.error(
        "Payment creation error:",
        paymentError
      );

      throw paymentError;
    }

    

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

    reused: false,
  };

   

    await completeIdempotencyRecord(
      idempotencyKey,
      response
    );

    
    await releaseLock(
      idempotencyKey,
      lockToken
    );

    lockToken = null;

    

    return NextResponse.json(
      response,
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Payment API error:",
      error
    );

    

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
      { status: 500 }
    );
  }
}





