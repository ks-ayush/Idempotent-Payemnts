import { SupabaseClient } from "@supabase/supabase-js";

export async function getCustomerHistory(
  supabase: SupabaseClient,
  customerId: string
) {

  const { data, error } = await supabase
    .from("payments")
    .select(
      "amount, created_at, payment_method"
    )
    .eq(
      "customer_id",
      customerId
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(100);

  if (error) {
    throw new Error(
      `Failed to get customer history: ${error.message}`
    );
  }

  return (data ?? []).map((payment) => ({
    amount: Number(payment.amount),

    created_at:
      payment.created_at,

    payment_method:
      payment.payment_method ?? "CARD",
  }));
}