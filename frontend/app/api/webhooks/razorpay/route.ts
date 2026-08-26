import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { supabase } from "@/lib/supabase";

function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
) {
  const expectedSignature =
    crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

  /*
   * Use timingSafeEqual instead of
   * directly comparing signatures.
   */

  const expectedBuffer =
    Buffer.from(expectedSignature, "utf8");

  const receivedBuffer =
    Buffer.from(signature, "utf8");

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
    /*
     * IMPORTANT:
     *
     * We must read the RAW body.
     *
     * Do not call request.json()
     * before signature verification.
     */

    const rawBody =
      await request.text();

    /*
     * Razorpay sends the signature
     * in this header.
     */

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
        { status: 400 }
      );
    }

    /*
     * Webhook secret configured in
     * Razorpay Dashboard.
     */

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
        { status: 500 }
      );
    }

    /*
     * 1. Verify Razorpay signature
     */

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
        { status: 401 }
      );
    }

    /*
     * 2. Parse the body AFTER
     * signature verification.
     */

    const event =
      JSON.parse(rawBody);

    const eventName =
      event?.event;

    console.log(
      "Razorpay webhook:",
      eventName
    );

    /*
     * 3. Get payment entity
     */

    const paymentEntity =
      event?.payload?.payment?.entity;

    /*
     * Some events may not contain
     * payment.entity.
     */

    if (!paymentEntity) {
      console.log(
        "Webhook does not contain payment entity:",
        eventName
      );

      return NextResponse.json({
        success: true,
        message:
          "Event received but no payment entity",
      });
    }

    const razorpayPaymentId =
      paymentEntity.id;

    const razorpayOrderId =
      paymentEntity.order_id;

    /*
     * We need an order ID to connect
     * the Razorpay payment to our
     * local payment record.
     */

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
        { status: 400 }
      );
    }

    /*
     * 4. Handle payment.authorized
     */

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

    /*
     * 5. Handle payment.captured
     */

    else if (
      eventName ===
      "payment.captured"
    ) {
      const { error } =
        await supabase
          .from("payments")
          .update({
            status: "SUCCESS",

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

    /*
     * 6. Handle payment.failed
     */

    else if (
      eventName ===
      "payment.failed"
    ) {
      const errorCode =
        paymentEntity.error_code ||
        null;

      const errorDescription =
        paymentEntity.error_description ||
        null;

      const { error } =
        await supabase
          .from("payments")
          .update({
            status: "FAILED",

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

    /*
     * 7. Handle order.paid
     *
     * This is another useful confirmation
     * that the order was paid.
     */

    else if (
      eventName ===
      "order.paid"
    ) {
      const orderEntity =
        event?.payload?.order?.entity;

      const orderId =
        orderEntity?.id ||
        razorpayOrderId;

      const { error } =
        await supabase
          .from("payments")
          .update({
            status: "SUCCESS",

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

    /*
     * 8. Ignore events we don't
     * currently need.
     */

    else {
      console.log(
        "Unhandled Razorpay event:",
        eventName
      );
    }

    /*
     * 9. Return 200
     */

    return NextResponse.json({
      success: true,
      received: true,
      event: eventName,
    });
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
      { status: 500 }
    );
  }
}