import { NextResponse } from "next/server";

import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .order("created_at", {
        ascending: false,
      })
      .limit(50);

    if (error) {
      throw error;
    }

    const payments = (data || []).map(
      (payment) => ({
        id: payment.id,
        payment_id: payment.id,

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

        idempotency_key:
          payment.idempotency_key,

        created_at:
          payment.created_at,
      })
    );

    return NextResponse.json({
      payments,
    });
  } catch (error) {
    console.error(
      "Payment history error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to load payment history",
      },
      { status: 500 }
    );
  }
}