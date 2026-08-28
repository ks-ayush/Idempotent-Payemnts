"use client";

import Script from "next/script";
import { useEffect, useState } from "react";


type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

type Payment = {
  id?: string;
  payment_id?: string;

  amount: number;
  currency: string;

  description?: string;
  payment_method?: string;

  idempotency_key?: string;

  status?: string;
  gateway_status?: string;

  razorpay_order_id?: string;
  razorpay_payment_id?: string;

  reused?: boolean;
  created_at?: string;

  risk_score?: number;
  risk_level?: RiskLevel;
  risk_factors?: string[];
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

declare global {
  interface Window {
    Razorpay: any;
  }
}

function generateIdempotencyKey() {
  if (
    typeof crypto !== "undefined" &&
    crypto.randomUUID
  ) {
    return crypto.randomUUID();
  }

  return `idem_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

export default function Home() {
  const [activePage, setActivePage] =
    useState("payments");

  const [customerId, setCustomerId] =
    useState("customer_1024");

  const [amount, setAmount] =
    useState("500");

  const [currency, setCurrency] =
    useState("INR");

  const [description, setDescription] =
    useState("Payment for order");

  const [paymentMethod, setPaymentMethod] =
    useState("UPI");

  const [idempotencyKey, setIdempotencyKey] =
    useState("");

  const [result, setResult] =
    useState<Payment | null>(null);

  const [history, setHistory] =
    useState<Payment[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [chatMessages, setChatMessages] =
    useState<ChatMessage[]>([
      {
        role: "assistant",
        content:
          "I can explain payment risk decisions, idempotency behavior, and transaction anomalies.",
      },
    ]);

  const [chatInput, setChatInput] =
    useState("");

  const [chatLoading, setChatLoading] =
    useState(false);



  useEffect(() => {
    setIdempotencyKey(
      generateIdempotencyKey()
    );
  }, []);



  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const response = await fetch(
        "/api/payments/history"
      );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      setHistory(
        data.payments || []
      );
    } catch {

    }
  }


  async function createPayment() {
    setLoading(true);
    setError("");

    try {


      const numericAmount =
        Number(amount);

      if (
        !Number.isFinite(
          numericAmount
        ) ||
        numericAmount <= 0
      ) {
        throw new Error(
          "Amount must be greater than 0"
        );
      }



      const response =
        await fetch(
          "/api/payments",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "Idempotency-Key":
                idempotencyKey,
            },

            body: JSON.stringify({
              customer_id:
                customerId,

              amount:
                numericAmount,

              currency,

              description,

              payment_method:
                paymentMethod,
            }),
          }
        );

      const data =
        await response.json();


      if (
        data.status === "HIGH_RISK"
      ) {
        const blockedPayment: Payment = {
          ...data,

          amount:
            numericAmount,

          currency,

          payment_method:
            paymentMethod,

          status:
            "BLOCKED",

          gateway_status:
            "RISK_BLOCKED",

          
        };

        
        setResult(blockedPayment);

       
        setLoading(false);

        return;
      }


      if (!response.ok) {
        throw new Error(
          data?.message ||
          data?.detail ||
          `Request failed with status ${response.status}`
        );
      }



      if (data.reused) {
        const payment: Payment = {
          ...data,

          idempotency_key:
            data.idempotency_key ||
            idempotencyKey,
        };

        setResult(payment);

        await loadHistory();

        return;
      }



      if (!window.Razorpay) {
        throw new Error(
          "Razorpay Checkout has not loaded yet. Please refresh the page and try again."
        );
      }


      if (
        !data.razorpay_order_id
      ) {
        throw new Error(
          "Razorpay order ID was not returned by the server."
        );
      }

      if (
        !data.razorpay_key_id
      ) {
        throw new Error(
          "Razorpay key ID was not returned by the server."
        );
      }



      const options = {
        key:
          data.razorpay_key_id,

        amount:
          Math.round(
            numericAmount * 100
          ),

        currency:
          currency.toUpperCase(),

        name:
          "PaySafe",

        description:
          description ||
          "Payment for order",

        order_id:
          data.razorpay_order_id,



        prefill: {
          name:
            customerId,
        },



        notes: {
          customer_id:
            customerId,

          idempotency_key:
            idempotencyKey,
        },

        theme: {
          color: "#ffffff",
        },



        handler:
          function (
            razorpayResponse: any
          ) {
            console.log(
              "Razorpay checkout response:",
              razorpayResponse
            );

            const payment: Payment = {
              ...data,

              razorpay_payment_id:
                razorpayResponse
                  ?.razorpay_payment_id,

              razorpay_order_id:
                razorpayResponse
                  ?.razorpay_order_id ||
                data.razorpay_order_id,

              idempotency_key:
                data.idempotency_key ||
                idempotencyKey,

              status:
                "PENDING",

              gateway_status:
                "AUTHORIZED",
            };

            setResult(
              payment
            );

            /*
             * The webhook should update
             * the database shortly.
             *
             * Refresh history after
             * a short delay.
             */

            setTimeout(() => {
              loadHistory();
            }, 1500);
          },

        /*
         * Checkout closed by user.
         */

        modal: {
          ondismiss:
            function () {
              setLoading(false);
            },
        },
      };

      /*
       * 6. Create Razorpay Checkout
       * instance.
       */

      const razorpay =
        new window.Razorpay(
          options
        );

      /*
       * 7. Listen for failed
       * payment.
       */

      razorpay.on(
        "payment.failed",
        function (
          response: any
        ) {
          console.error(
            "Razorpay payment failed:",
            response
          );

          const failureMessage =
            response?.error
              ?.description ||
            response?.error
              ?.reason ||
            "Payment failed";

          setError(
            failureMessage
          );

          const failedPayment:
            Payment = {
            ...data,

            status:
              "FAILED",

            gateway_status:
              "FAILED",

            razorpay_order_id:
              data.razorpay_order_id,

            idempotency_key:
              data.idempotency_key ||
              idempotencyKey,
          };

          setResult(
            failedPayment
          );

          /*
           * Give webhook a little time
           * to update Supabase.
           */

          setTimeout(() => {
            loadHistory();
          }, 1000);
        }
      );

      /*
       * 8. Open Razorpay Checkout.
       */

      razorpay.open();
    } catch (err) {
      console.error(
        "Payment checkout error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Start a completely new payment.
   */

  function newPayment() {
    setIdempotencyKey(
      generateIdempotencyKey()
    );

    setResult(null);

    setError("");

    setAmount("500");

    setCurrency("INR");

    setDescription(
      "Payment for order"
    );

    setPaymentMethod("UPI");
  }

  /*
   * AI assistant.
   */

  async function askAI() {
    if (!chatInput.trim()) {
      return;
    }

    const question =
      chatInput.trim();

    setChatInput("");

    setChatMessages(
      (previous) => [
        ...previous,

        {
          role: "user",
          content: question,
        },
      ]
    );

    setChatLoading(true);

    try {
      const response =
        await fetch(
          "/api/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              message:
                question,

              payment:
                result,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
          "AI request failed"
        );
      }

      setChatMessages(
        (previous) => [
          ...previous,

          {
            role: "assistant",
            content:
              data.message ||
              "I couldn't analyze that payment.",
          },
        ]
      );
    } catch (err) {
      setChatMessages(
        (previous) => [
          ...previous,

          {
            role: "assistant",
            content:
              err instanceof Error
                ? err.message
                : "AI service unavailable.",
          },
        ]
      );
    } finally {
      setChatLoading(
        false
      );
    }
  }

  const status =
    String(
      result?.status ||
      "READY"
    ).toUpperCase();

  const riskLevel =
    result?.risk_level;

  return (
    <>
      {/* Razorpay Checkout */}

      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
      />

      <main className="min-h-screen bg-[#09090b] text-white">
        <div className="flex min-h-screen">

          {/* SIDEBAR */}

          <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#0d0d0f] lg:flex lg:flex-col">

            <div className="border-b border-white/10 p-5">

              <div className="flex items-center gap-3">

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white font-bold text-black">
                  P
                </div>

                <div>
                  <p className="font-semibold">
                    PaySafe
                  </p>

                  <p className="text-[10px] text-zinc-500">
                    RISK MANAGER
                  </p>
                </div>

              </div>

            </div>

            <div className="p-4">

              <button
                onClick={() => {
                  setActivePage(
                    "payments"
                  );

                  newPayment();
                }}
                className="flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black"
              >
                <span>
                  +
                </span>

                New payment
              </button>

            </div>

            <nav className="px-3">

              <SidebarItem
                active={
                  activePage ===
                  "payments"
                }
                onClick={() =>
                  setActivePage(
                    "payments"
                  )
                }
                icon="▣"
                label="Payments"
              />

              <SidebarItem
                active={
                  activePage ===
                  "history"
                }
                onClick={() =>
                  setActivePage(
                    "history"
                  )
                }
                icon="◷"
                label="Payment history"
              />

              {/* <SidebarItem
                active={
                  activePage ===
                  "chat"
                }
                onClick={() =>
                  setActivePage(
                    "chat"
                  )
                }
                icon="✦"
                label="AI assistant"
              /> */}

            </nav>

            <div className="mt-auto border-t border-white/10 p-4">

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">

                <div className="flex items-center gap-2">

                  <span className="h-2 w-2 rounded-full bg-green-400" />

                  <span className="text-xs text-zinc-300">
                    System operational
                  </span>

                </div>

                <p className="mt-2 text-[10px] leading-4 text-zinc-600">
                  BY Ayush Kumar
                </p>

              </div>

            </div>

          </aside>

          {/* MAIN */}

          <div className="min-w-0 flex-1">

            {/* TOP NAV */}

            <header className="flex h-16 items-center justify-between border-b border-white/10 px-5 lg:px-8">

              <div>

                <p className="text-xs text-zinc-500">
                  PAYMENT RISK MANAGER
                </p>

                <h1 className="font-semibold">

                  {activePage ===
                    "payments"
                    ? "New Payment"
                    : activePage ===
                      "history"
                      ? "Payment History"
                      : "AI Risk Assistant"}

                </h1>

              </div>

              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">

                <span className="h-2 w-2 rounded-full bg-green-400" />

                Live

              </div>

            </header>

            {/* CONTENT */}

            <div className="mx-auto max-w-7xl p-5 lg:p-8">

              {activePage ===
                "payments" && (
                  <PaymentPage
                    customerId={
                      customerId
                    }
                    setCustomerId={
                      setCustomerId
                    }
                    amount={amount}
                    setAmount={
                      setAmount
                    }
                    currency={
                      currency
                    }
                    setCurrency={
                      setCurrency
                    }
                    description={
                      description
                    }
                    setDescription={
                      setDescription
                    }
                    paymentMethod={
                      paymentMethod
                    }
                    setPaymentMethod={
                      setPaymentMethod
                    }
                    idempotencyKey={
                      idempotencyKey
                    }
                    setIdempotencyKey={
                      setIdempotencyKey
                    }
                    result={result}
                    loading={loading}
                    error={error}
                    status={status}
                    riskLevel={
                      riskLevel
                    }
                    createPayment={
                      createPayment
                    }
                    newPayment={
                      newPayment
                    }
                    setActivePage={
                      setActivePage
                    }
                  />
                )}

              {activePage ===
                "history" && (
                  <HistoryPage
                    history={history}
                    setResult={
                      setResult
                    }
                    setActivePage={
                      setActivePage
                    }
                  />
                )}

              {activePage ===
                "chat" && (
                  <ChatPage
                    messages={
                      chatMessages
                    }
                    input={
                      chatInput
                    }
                    setInput={
                      setChatInput
                    }
                    loading={
                      chatLoading
                    }
                    askAI={
                      askAI
                    }
                    result={
                      result
                    }
                  />
                )}

            </div>

          </div>

        </div>
      </main>
    </>
  );
}


/* -------------------------------------------------- */
/* PAYMENT PAGE */
/* -------------------------------------------------- */

function PaymentPage({
  customerId,
  setCustomerId,
  amount,
  setAmount,
  currency,
  setCurrency,
  description,
  setDescription,
  paymentMethod,
  setPaymentMethod,
  idempotencyKey,
  setIdempotencyKey,
  result,
  loading,
  error,
  status,
  riskLevel,
  createPayment,
  newPayment,
  setActivePage,
}: any) {
  return (
    <div>

      {/* HERO */}

      <section className="mb-8">

        <p className="text-xs font-bold tracking-[0.25em] text-zinc-600">
          AI RISK MANAGER
        </p>

        <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
          Process payments without

          <span className="text-zinc-500">
            {" "}double charges or blind risk.
          </span>
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
          Every payment is protected by idempotency and
          is evaluated by the fraud-risk model.
        </p>

      </section>


      {/* GRID */}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">

        {/* PAYMENT FORM */}

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">

          <div className="flex items-start justify-between">

            <div>

              <p className="text-xs font-bold tracking-widest text-zinc-600">
                PAYMENT
              </p>

              <h3 className="mt-2 text-xl font-semibold">
                Checkout
              </h3>

            </div>

            <button
              onClick={
                newPayment
              }
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              New payment
            </button>

          </div>


          {/* CUSTOMER */}

          <Field
            label="Customer ID"
            description="Used to retrieve transaction history for risk analysis."
          >

            <input
              value={
                customerId
              }
              onChange={(e) =>
                setCustomerId(
                  e.target.value
                )
              }
              className={
                inputClass
              }
              placeholder="customer_1024"
            />

          </Field>


          {/* AMOUNT */}

          <Field label="Amount">

            <div className="flex h-12 overflow-hidden rounded-xl border border-white/10 bg-black">

              <span className="flex items-center px-4 text-zinc-500">
                ₹
              </span>

              <input
                type="number"
                min="1"
                value={
                  amount
                }
                onChange={(e) =>
                  setAmount(
                    e.target.value
                  )
                }
                className="min-w-0 flex-1 bg-transparent px-2 text-lg font-semibold outline-none"
              />

              <select
                value={
                  currency
                }
                onChange={(e) =>
                  setCurrency(
                    e.target.value
                  )
                }
                className="border-l border-white/10 bg-black px-4 text-sm outline-none"
              >

                <option value="INR">
                  INR
                </option>

                <option value="USD">
                  USD
                </option>

                <option value="EUR">
                  EUR
                </option>

              </select>

            </div>

          </Field>


          {/* PAYMENT METHOD */}

          <Field label="Payment method">

            <select
              value={
                paymentMethod
              }
              onChange={(e) =>
                setPaymentMethod(
                  e.target.value
                )
              }
              className={
                inputClass
              }
            >

              <option value="UPI">
                UPI
              </option>

              <option value="CARD">
                Card
              </option>

              <option value="NET_BANKING">
                Net Banking
              </option>

            </select>

          </Field>


          {/* DESCRIPTION */}

          <Field label="Description">

            <input
              value={
                description
              }
              onChange={(e) =>
                setDescription(
                  e.target.value
                )
              }
              className={
                inputClass
              }
              placeholder="Payment for order"
            />

          </Field>


          {/* IDEMPOTENCY */}

          <div className="mt-6">

            <div className="flex items-center justify-between">

              <label className="text-sm font-medium">
                Idempotency Key
              </label>

              <button
                onClick={() =>
                  navigator.clipboard?.writeText(
                    idempotencyKey
                  )
                }
                className="text-xs text-zinc-600 hover:text-white"
              >
                Copy
              </button>

            </div>

            <input
              value={
                idempotencyKey
              }
              onChange={(e) =>
                setIdempotencyKey(
                  e.target.value
                )
              }
              className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black px-4 font-mono text-xs text-zinc-400 outline-none"
            />

            <p className="mt-2 text-xs leading-5 text-zinc-600">
              Keep this key unchanged to simulate a
              retry.
            </p>

          </div>


          {/* PAY */}

          <button
            onClick={
              createPayment
            }
            disabled={
              loading ||
              !idempotencyKey
            }
            className="mt-6 h-13 w-full rounded-xl bg-white py-4 font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Creating checkout..."
              : "Analyze & Pay"}
          </button>


          {/* RETRY */}

          <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">

            <div className="flex gap-3">

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                ↻
              </div>

              <div>

                <p className="text-sm font-semibold">
                  Idempotency retry test
                </p>

                <p className="mt-1 text-xs leading-5 text-zinc-600">
                  Click Analyze & Pay again without
                  changing the key. The server should
                  return the existing payment.
                </p>

              </div>

            </div>

          </div>

        </section>


        {/* RESULT */}

        <section className="space-y-6">

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">

            <p className="text-xs font-bold tracking-widest text-zinc-600">
              PAYMENT RESULT
            </p>

            {!result ? (

              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 text-zinc-600">
                  ↗
                </div>

                <h3 className="mt-5 font-semibold">
                  No payment yet
                </h3>

                <p className="mt-2 max-w-xs text-xs leading-5 text-zinc-600">
                  Submit a payment to see the
                  idempotency and risk result.
                </p>

              </div>

            ) : (

              <div className="mt-6">

                <div className="flex items-center justify-between">

                  <span
                    className={
                      statusClass(
                        status
                      )
                    }
                  >

                    <span className="h-2 w-2 rounded-full bg-current" />

                    {status}

                  </span>

                  {result.reused && (
                    <span className="rounded-full bg-blue-400/10 px-3 py-2 text-[10px] font-bold text-blue-400">
                      IDEMPOTENT RETRY
                    </span>
                  )}

                </div>

                <Info
                  label="Payment ID"
                  value={
                    result.payment_id ||
                    result.id ||
                    "—"
                  }
                />

                <Info
                  label="Razorpay Order"
                  value={
                    result.razorpay_order_id ||
                    "—"
                  }
                />

                <Info
                  label="Razorpay Payment"
                  value={
                    result.razorpay_payment_id ||
                    "Waiting for payment"
                  }
                />

                <Info
                  label="Customer"
                  value={
                    customerId
                  }
                />

                <Info
                  label="Amount"
                  value={`${result.amount} ${result.currency}`}
                />

                <Info
                  label="Payment method"
                  value={
                    result.payment_method ||
                    paymentMethod
                  }
                />

                <Info
                  label="Gateway status"
                  value={
                    result.gateway_status ||
                    "—"
                  }
                />

                <Info
                  label="Idempotency"
                  value={
                    result.reused
                      ? "Previous result reused"
                      : "New payment"
                  }
                />

                <Info
                  label="Idempotency Key"
                  value={
                    result.idempotency_key ||
                    idempotencyKey
                  }
                />

              </div>

            )}

            {error && (
              <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                {error}
              </div>
            )}

          </div>


          {/* RISK */}

          {result && (
            <RiskPanel
              result={result}
              setActivePage={
                setActivePage
              }
            />
          )}

        </section>

      </div>

    </div>
  );
}


/* -------------------------------------------------- */
/* RISK PANEL */
/* -------------------------------------------------- */

function RiskPanel({
  result,
  setActivePage,
}: {
  result: Payment;
  setActivePage: (
    page: string
  ) => void;
}) {
  const score =
    result.risk_score;

  const level =
    result.risk_level ||
    (score === undefined
      ? undefined
      : score >= 70
        ? "HIGH"
        : score >= 40
          ? "MEDIUM"
          : "LOW");

  if (score === undefined) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">

        <div className="flex items-center justify-between">

          <div>

            <p className="text-xs font-bold tracking-widest text-zinc-600">
              AI RISK ENGINE
            </p>

            <h3 className="mt-2 font-semibold">
              Risk analysis pending
            </h3>

          </div>

          <span className="rounded-full bg-zinc-400/10 px-3 py-2 text-xs text-zinc-500">
            WAITING
          </span>

        </div>

        <p className="mt-4 text-xs leading-5 text-zinc-600">
          The FastAPI ML service will return the
          fraud-risk score here.
        </p>

      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-xs font-bold tracking-widest text-zinc-600">
            AI RISK ENGINE
          </p>

          <h3 className="mt-2 text-xl font-semibold">
            Fraud Risk Assessment
          </h3>

        </div>

        <span
          className={
            level === "HIGH"
              ? "rounded-full bg-red-400/10 px-3 py-2 text-xs font-bold text-red-400"
              : level === "MEDIUM"
                ? "rounded-full bg-yellow-400/10 px-3 py-2 text-xs font-bold text-yellow-400"
                : "rounded-full bg-green-400/10 px-3 py-2 text-xs font-bold text-green-400"
          }
        >
          {level}
        </span>

      </div>

      <div className="mt-7 flex items-end gap-3">

        <span className="text-5xl font-bold">
          {score}
        </span>

        <span className="mb-2 text-sm text-zinc-600">
          / 100 risk
        </span>

      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">

        <div
          className="h-full rounded-full bg-white transition-all"
          style={{
            width: `${Math.min(
              score,
              100
            )}%`,
          }}
        />

      </div>

      {result.risk_factors &&
        result.risk_factors.length >
        0 && (

          <div className="mt-7">

            <p className="text-xs font-semibold text-zinc-500">
              PAYMENT WAS FLAGGED
            </p>

            <div className="mt-3 space-y-2">

              {result.risk_factors.map(
                (
                  factor,
                  index
                ) => (

                  <div
                    key={index}
                    className="flex gap-3 rounded-xl border border-white/5 bg-black/20 p-3"
                  >

                    <span className="text-yellow-400">
                      ⚠
                    </span>

                    <span className="text-xs text-zinc-400">
                      {factor}
                    </span>

                  </div>

                )
              )}

            </div>

          </div>
        )}

      <button
        onClick={() =>
          setActivePage(
            "chat"
          )
        }
        className="mt-5 w-full rounded-xl border border-white/10 py-3 text-xs font-semibold text-zinc-300 hover:bg-white/5 hover:text-white"
      >
        Ask AI about this payment →
      </button>

    </div>
  );
}


/* -------------------------------------------------- */
/* HISTORY */
/* -------------------------------------------------- */

function HistoryPage({
  history,
  setResult,
  setActivePage,
}: {
  history: Payment[];
  setResult: (
    payment: Payment
  ) => void;
  setActivePage: (
    page: string
  ) => void;
}) {
  return (
    <div>

      <div className="mb-8">

        <p className="text-xs font-bold tracking-[0.25em] text-zinc-600">
          PAYMENTS
        </p>

        <h2 className="mt-3 text-3xl font-bold">
          Payment history
        </h2>

        <p className="mt-2 text-sm text-zinc-600">
          Persistent payment records .
        </p>

      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">

        {history.length === 0 ? (

          <div className="p-8 text-sm text-zinc-600">
            No payment history yet.
          </div>

        ) : (

          history.map(
            (
              payment,
              index
            ) => (

              <button
                key={`${payment.id || payment.payment_id}-${index}`}
                onClick={() => {
                  setResult(
                    payment
                  );

                  setActivePage(
                    "payments"
                  );
                }}
                className="flex w-full items-center justify-between border-b border-white/5 p-5 text-left transition last:border-0 hover:bg-white/[0.03]"
              >

                <div>

                  <p className="text-sm font-semibold">
                    {payment.payment_id ||
                      payment.id ||
                      "Unknown"}
                  </p>

                  <p className="mt-1 font-mono text-[10px] text-zinc-700">
                    {
                      payment.idempotency_key
                    }
                  </p>

                  {payment.razorpay_order_id && (
                    <p className="mt-1 font-mono text-[10px] text-zinc-700">
                      {
                        payment.razorpay_order_id
                      }
                    </p>
                  )}

                </div>

                <div className="flex items-center gap-8">

                  <div className="text-right">

                    <p className="text-sm font-semibold">
                      {payment.amount}{" "}
                      {payment.currency}
                    </p>

                    <p className="mt-1 text-[10px] uppercase text-zinc-600">
                      {payment.status ||
                        "UNKNOWN"}
                    </p>

                  </div>

                  {payment.risk_level && (
                    <RiskBadge
                      level={
                        payment.risk_level
                      }
                    />
                  )}

                </div>

              </button>

            )
          )

        )}

      </div>

    </div>
  );
}


/* -------------------------------------------------- */
/* CHAT */
/* -------------------------------------------------- */

function ChatPage({
  messages,
  input,
  setInput,
  loading,
  askAI,
  result,
}: {
  messages: ChatMessage[];
  input: string;
  setInput: (
    value: string
  ) => void;
  loading: boolean;
  askAI: () => void;
  result: Payment | null;
}) {
  return (
    <div className="mx-auto max-w-5xl">

      <div className="mb-8">

        <p className="text-xs font-bold tracking-[0.25em] text-zinc-600">
          AI ASSISTANT
        </p>

        <h2 className="mt-3 text-3xl font-bold">
          Risk analyst
        </h2>

        <p className="mt-2 text-sm text-zinc-600">
          Ask questions about payment risk decisions.
        </p>

      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">

        <div className="min-h-[450px] space-y-5 p-6">

          {messages.map(
            (
              message,
              index
            ) => (

              <div
                key={index}
                className={
                  message.role ===
                    "user"
                    ? "ml-auto max-w-xl rounded-2xl bg-white p-4 text-sm text-black"
                    : "max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-zinc-400"
                }
              >
                {message.content}
              </div>

            )
          )}

          {loading && (

            <div className="max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs text-zinc-600">
              Analyzing payment...
            </div>

          )}

        </div>

        {result && (

          <div className="border-t border-white/10 px-6 py-3">

            <p className="text-[10px] uppercase tracking-widest text-zinc-700">
              Current payment
            </p>

            <p className="mt-1 text-xs text-zinc-500">
              {result.payment_id ||
                result.id ||
                "Unknown"}{" "}
              · {result.amount}{" "}
              {result.currency}
            </p>

          </div>

        )}

        <div className="border-t border-white/10 p-4">

          <div className="flex gap-3">

            <input
              value={input}
              onChange={(e) =>
                setInput(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key ===
                  "Enter"
                ) {
                  askAI();
                }
              }}
              placeholder="Why was this payment flagged?"
              className="h-12 flex-1 rounded-xl border border-white/10 bg-black px-4 text-sm outline-none focus:border-white/30"
            />

            <button
              onClick={askAI}
              disabled={
                loading ||
                !input.trim()
              }
              className="rounded-xl bg-white px-5 text-sm font-semibold text-black disabled:opacity-40"
            >
              Ask
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}


/* -------------------------------------------------- */
/* SMALL COMPONENTS */
/* -------------------------------------------------- */

function SidebarItem({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={
        onClick
      }
      className={`mb-1 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${active
          ? "bg-white/10 text-white"
          : "text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
        }`}
    >
      <span>
        {icon}
      </span>

      {label}
    </button>
  );
}


function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">

      <label className="text-sm font-medium">
        {label}
      </label>

      {description && (
        <p className="mt-1 text-[10px] text-zinc-700">
          {description}
        </p>
      )}

      <div className="mt-2">
        {children}
      </div>

    </div>
  );
}


function Info({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-5 border-b border-white/5 py-4">

      <span className="text-xs text-zinc-600">
        {label}
      </span>

      <strong className="max-w-[60%] break-all text-right font-mono text-xs text-zinc-400">
        {value}
      </strong>

    </div>
  );
}


function RiskBadge({
  level,
}: {
  level: RiskLevel;
}) {
  return (
    <span
      className={
        level ===
          "HIGH"
          ? "rounded-full bg-red-400/10 px-3 py-2 text-[10px] font-bold text-red-400"
          : level ===
            "MEDIUM"
            ? "rounded-full bg-yellow-400/10 px-3 py-2 text-[10px] font-bold text-yellow-400"
            : "rounded-full bg-green-400/10 px-3 py-2 text-[10px] font-bold text-green-400"
      }
    >
      {level}
    </span>
  );
}


function statusClass(
  status: string
) {
  if (
    status ===
    "SUCCESS"
  ) {
    return "inline-flex items-center gap-2 rounded-full bg-green-400/10 px-3 py-2 text-xs font-bold text-green-400";
  }

  if (
    status ===
    "FAILED" ||
    status ===
    "REJECTED"
  ) {
    return "inline-flex items-center gap-2 rounded-full bg-red-400/10 px-3 py-2 text-xs font-bold text-red-400";
  }

  if (
    status ===
    "PENDING"
  ) {
    return "inline-flex items-center gap-2 rounded-full bg-yellow-400/10 px-3 py-2 text-xs font-bold text-yellow-400";
  }

  return "inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-zinc-400";
}


const inputClass =
  "h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-sm outline-none focus:border-white/30";








