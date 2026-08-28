import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { supabase } from "@/lib/supabase";


function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(rawBody)
      .digest("hex");


  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "utf8"
    );

  const receivedBuffer =
    Buffer.from(
      signature,
      "utf8"
    );


  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    return false;
  }


  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );
}


export async function POST(
  request: NextRequest
) {

  try {

    // =====================================================
    // 1. READ RAW BODY
    // =====================================================

    const rawBody =
      await request.text();


    // =====================================================
    // 2. GET SIGNATURE
    // =====================================================

    const signature =
      request.headers.get(
        "X-Razorpay-Signature"
      );


    if (!signature) {

      console.error(
        "Missing Razorpay webhook signature"
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Missing webhook signature",
        },
        {
          status: 400,
        }
      );
    }


    // =====================================================
    // 3. GET WEBHOOK SECRET
    // =====================================================

    const webhookSecret =
      process.env.RZP_WEBHOOK_SECRET;


    if (!webhookSecret) {

      console.error(
        "RZP_WEBHOOK_SECRET is missing"
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Webhook secret is not configured",
        },
        {
          status: 500,
        }
      );
    }


    // =====================================================
    // 4. VERIFY SIGNATURE
    // =====================================================

    const validSignature =
      verifyWebhookSignature(
        rawBody,
        signature,
        webhookSecret
      );


    if (!validSignature) {

      console.error(
        "Invalid Razorpay webhook signature"
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid webhook signature",
        },
        {
          status: 401,
        }
      );
    }


    // =====================================================
    // 5. WEBHOOK EVENT ID
    // =====================================================

    const eventId =
      request.headers.get(
        "x-razorpay-event-id"
      );


    console.log(
      "Razorpay event ID:",
      eventId
    );


    // =====================================================
    // 6. PARSE BODY
    // =====================================================

    const event =
      JSON.parse(rawBody);


    const eventName =
      event?.event;


    console.log(
      "Razorpay webhook:",
      eventName
    );


    // =====================================================
    // 7. GET PAYMENT ENTITY
    // =====================================================

    const paymentEntity =
      event?.payload?.payment?.entity;


    // order.paid can contain both order
    // and payment information.
    //
    // We use payment.entity when available.

    if (!paymentEntity) {

      console.log(
        "No payment entity:",
        eventName
      );

      return NextResponse.json(
        {
          success: true,
          received: true,
          event: eventName,
        },
        {
          status: 200,
        }
      );
    }


    const razorpayPaymentId =
      paymentEntity?.id ||
      null;


    const razorpayOrderId =
      paymentEntity?.order_id ||
      null;


    // =====================================================
    // 8. ORDER ID REQUIRED
    // =====================================================

    if (!razorpayOrderId) {

      console.error(
        "Webhook payment has no order_id"
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Missing Razorpay order ID",
        },
        {
          status: 400,
        }
      );
    }


    // =====================================================
    // 9. AUTHORIZED
    // =====================================================

    if (
      eventName ===
      "payment.authorized"
    ) {

      const { error } =
        await supabase
          .from("payments")
          .update({

            gateway_status:
              "AUTHORIZED",

            razorpay_payment_id:
              razorpayPaymentId,

            razorpay_signature:
              signature,

            updated_at:
              new Date().toISOString(),

          })
          .eq(
            "razorpay_order_id",
            razorpayOrderId
          );


      if (error) {
        throw error;
      }


      console.log(
        "Payment authorized:",
        razorpayOrderId
      );
    }


    // =====================================================
    // 10. CAPTURED
    // =====================================================

    else if (
      eventName ===
      "payment.captured"
    ) {

      const { error } =
        await supabase
          .from("payments")
          .update({

            status:
              "SUCCESS",

            gateway_status:
              "CAPTURED",

            razorpay_payment_id:
              razorpayPaymentId,

            razorpay_signature:
              signature,

            updated_at:
              new Date().toISOString(),

          })
          .eq(
            "razorpay_order_id",
            razorpayOrderId
          );


      if (error) {
        throw error;
      }


      console.log(
        "Payment captured:",
        razorpayOrderId
      );
    }


    // =====================================================
    // 11. FAILED
    // =====================================================

    else if (
      eventName ===
      "payment.failed"
    ) {

      const errorCode =
        paymentEntity?.error_code ||
        null;


      const errorDescription =
        paymentEntity
          ?.error_description ||
        null;


      const { error } =
        await supabase
          .from("payments")
          .update({

            status:
              "FAILED",

            gateway_status:
              "FAILED",

            razorpay_payment_id:
              razorpayPaymentId,

            razorpay_signature:
              signature,

            failure_code:
              errorCode,

            failure_reason:
              errorDescription,

            updated_at:
              new Date().toISOString(),

          })
          .eq(
            "razorpay_order_id",
            razorpayOrderId
          );


      if (error) {
        throw error;
      }


      console.log(
        "Payment failed:",
        razorpayOrderId
      );
    }


    // =====================================================
    // 12. ORDER PAID
    // =====================================================

    else if (
      eventName ===
      "order.paid"
    ) {

      const orderEntity =
        event?.payload
          ?.order
          ?.entity;


      const orderId =
        orderEntity?.id ||
        razorpayOrderId;


      const { error } =
        await supabase
          .from("payments")
          .update({

            status:
              "SUCCESS",

            gateway_status:
              "PAID",

            razorpay_payment_id:
              razorpayPaymentId,

            razorpay_signature:
              signature,

            updated_at:
              new Date().toISOString(),

          })
          .eq(
            "razorpay_order_id",
            orderId
          );


      if (error) {
        throw error;
      }


      console.log(
        "Order paid:",
        orderId
      );
    }


    // =====================================================
    // 13. OTHER EVENTS
    // =====================================================

    else {

      console.log(
        "Unhandled Razorpay event:",
        eventName
      );
    }


    // =====================================================
    // 14. SUCCESS RESPONSE
    // =====================================================

    return NextResponse.json(
      {
        success: true,
        received: true,
        event: eventName,
        event_id: eventId,
      },
      {
        status: 200,
      }
    );


  } catch (error) {

    console.error(
      "Razorpay webhook error:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "Webhook processing failed",
      },
      {
        status: 500,
      }
    );
  }
}

