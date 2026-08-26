export type RiskResult = {
  risk_score: number;
  risk_probability: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  risk_factors: string[];
  threshold: number;
};

type CustomerHistory = {
  amount: number;
  created_at: string;
  payment_method?: string;
};

type RiskInput = {
  amount: number;
  paymentMethod: string;
  createdAt: string;
  retryCount: number;
  customerHistory: CustomerHistory[];
};


export async function scoreTransaction(
  input: RiskInput
): Promise<RiskResult | null> {

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 800);

  try {

    const response = await fetch(
      `${process.env.RISK_SERVICE_URL}/score`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          transaction: {
            amount: Number(input.amount),

            payment_method:
              input.paymentMethod || "CARD",

            created_at:
              input.createdAt,

            retry_count:
              Number(input.retryCount || 0),
          },

          customer_history:
            input.customerHistory,
        }),

        signal: controller.signal,
      }
    );

    if (!response.ok) {
      console.error(
        "Risk service status:",
        response.status
      );

      return null;
    }

    return await response.json();

  } catch (error) {

    console.error(
      "Risk service unavailable:",
      error
    );

    return null;

  } finally {

    clearTimeout(timeout);
  }
}