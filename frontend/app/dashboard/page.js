"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

type Payment = {
  id: string;
  amount: number;
  currency: string;
  riskScore: number;
  riskLevel: RiskLevel;
  status: "APPROVED" | "REVIEW" | "BLOCKED";
  createdAt: string;
};

const riskStyles = {
  LOW: {
    badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-400",
    dot: "bg-emerald-400",
  },
  MEDIUM: {
    badge: "border-amber-400/20 bg-amber-400/10 text-amber-400",
    dot: "bg-amber-400",
  },
  HIGH: {
    badge: "border-red-400/20 bg-red-400/10 text-red-400",
    dot: "bg-red-400",
  },
};

export default function DashboardPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState("5000");
  const [currency, setCurrency] = useState("INR");
  const [description, setDescription] = useState("Payment for order");

  const [analyzing, setAnalyzing] = useState(false);

  const [result, setResult] = useState<Payment | null>(null);

  const [payments, setPayments] = useState<Payment[]>([
    {
      id: "pay_8291",
      amount: 42000,
      currency: "INR",
      riskScore: 0.93,
      riskLevel: "HIGH",
      status: "REVIEW",
      createdAt: "2 min ago",
    },
    {
      id: "pay_8274",
      amount: 18500,
      currency: "INR",
      riskScore: 0.81,
      riskLevel: "HIGH",
      status: "BLOCKED",
      createdAt: "18 min ago",
    },
    {
      id: "pay_8261",
      amount: 9200,
      currency: "INR",
      riskScore: 0.21,
      riskLevel: "LOW",
      status: "APPROVED",
      createdAt: "31 min ago",
    },
    {
      id: "pay_8254",
      amount: 3500,
      currency: "INR",
      riskScore: 0.32,
      riskLevel: "LOW",
      status: "APPROVED",
      createdAt: "45 min ago",
    },
  ]);

  const supabase = createClient();

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      setEmail(user.email ?? "");
      setLoading(false);
    }

    getUser();
  }, [supabase]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function analyzePayment() {
    setAnalyzing(true);

    /*
      Temporary simulation.

      Later this will become:

      fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": ...
        },
        body: JSON.stringify(...)
      })
    */

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const numericAmount = Number(amount);

    let score = 0.15;

    if (numericAmount > 10000) {
      score += 0.25;
    }

    if (numericAmount > 25000) {
      score += 0.25;
    }

    if (numericAmount > 50000) {
      score += 0.2;
    }

    score = Math.min(score, 0.95);

    let riskLevel: RiskLevel = "LOW";
    let status: Payment["status"] = "APPROVED";

    if (score >= 0.7) {
      riskLevel = "HIGH";
      status = "REVIEW";
    } else if (score >= 0.4) {
      riskLevel = "MEDIUM";
      status = "REVIEW";
    }

    const payment: Payment = {
      id: `pay_${Math.floor(Math.random() * 90000) + 10000}`,
      amount: numericAmount,
      currency,
      riskScore: score,
      riskLevel,
      status,
      createdAt: "Just now",
    };

    setResult(payment);
    setPayments((previous) => [payment, ...previous]);

    setAnalyzing(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090b] text-white">
        <p className="text-sm text-zinc-500">
          Loading dashboard...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      {/* Navbar */}

      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white font-bold text-black">
              P
            </div>

            <div>
              <p className="font-semibold">PaySafe AI</p>

              <p className="text-[10px] uppercase tracking-widest text-zinc-600">
                Risk Manager
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-7 text-sm text-zinc-500 md:flex">
            <Link
              href="/dashboard"
              className="text-white"
            >
              Dashboard
            </Link>

            <Link
              href="/payments"
              className="hover:text-white"
            >
              Payments
            </Link>

            <Link
              href="/risk"
              className="hover:text-white"
            >
              Risk Analytics
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-zinc-600">
                Signed in as
              </p>

              <p className="max-w-[180px] truncate text-xs text-zinc-300">
                {email}
              </p>
            </div>

            <button
              onClick={logout}
              className="rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Header */}

      <section className="mx-auto max-w-7xl px-6 pb-8 pt-10">
        <p className="text-xs font-bold tracking-[0.3em] text-zinc-600">
          MERCHANT DASHBOARD
        </p>

        <h1 className="mt-3 text-3xl font-semibold">
          Payment Risk Overview
        </h1>

        <p className="mt-2 text-sm text-zinc-500">
          Monitor transactions and analyze payment risk in real time.
        </p>
      </section>

      {/* Metrics */}

      <section className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-6 md:grid-cols-4">
        <Metric
          label="Transactions"
          value="12,453"
          description="+8.4% this month"
        />

        <Metric
          label="High Risk"
          value="231"
          description="1.8% of transactions"
        />

        <Metric
          label="Precision"
          value="91.4%"
          description="Held-out test set"
        />

        <Metric
          label="Recall"
          value="87.2%"
          description="Held-out test set"
        />
      </section>

      {/* Main Grid */}

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_1fr]">
        {/* Analyze Payment */}

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7">
          <div>
            <p className="text-xs font-bold tracking-widest text-zinc-600">
              PAYMENT RISK CHECK
            </p>

            <h2 className="mt-2 text-xl font-semibold">
              Analyze a transaction
            </h2>

            <p className="mt-2 text-xs leading-6 text-zinc-500">
              Submit a transaction to evaluate its risk before processing.
            </p>
          </div>

          {/* Amount */}

          <div className="mt-7">
            <label className="text-sm font-medium">
              Amount
            </label>

            <div className="mt-2 flex h-13 overflow-hidden rounded-xl border border-white/10 bg-black">
              <div className="flex items-center px-4 text-zinc-500">
                ₹
              </div>

              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="min-w-0 flex-1 bg-transparent px-2 text-lg font-semibold outline-none"
              />

              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="border-l border-white/10 bg-black px-4 text-sm outline-none"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          {/* Description */}

          <div className="mt-5">
            <label className="text-sm font-medium">
              Description
            </label>

            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-sm outline-none focus:border-white/30"
            />
          </div>

          {/* Analyze */}

          <button
            onClick={analyzePayment}
            disabled={analyzing}
            className="mt-6 h-13 w-full rounded-xl bg-white font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {analyzing
              ? "Analyzing transaction..."
              : "Analyze Payment"}
          </button>

          <p className="mt-3 text-center text-[11px] text-zinc-700">
            AI risk scoring • Payment protection • Fraud detection
          </p>
        </div>

        {/* Risk Result */}

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7">
          <p className="text-xs font-bold tracking-widest text-zinc-600">
            AI RISK ASSESSMENT
          </p>

          {!result ? (
            <div className="flex min-h-[350px] flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 text-xl text-zinc-600">
                ✦
              </div>

              <h3 className="mt-5 text-sm font-semibold">
                Waiting for transaction
              </h3>

              <p className="mt-2 max-w-sm text-xs leading-6 text-zinc-600">
                Analyze a payment to see the AI-generated risk score,
                decision and contributing factors.
              </p>
            </div>
          ) : (
            <RiskResult payment={result} />
          )}
        </div>
      </section>

      {/* Recent Transactions */}

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest text-zinc-600">
              TRANSACTION MONITOR
            </p>

            <h2 className="mt-2 text-xl font-semibold">
              Recent transactions
            </h2>
          </div>

          <Link
            href="/payments"
            className="text-xs text-zinc-500 hover:text-white"
          >
            View all →
          </Link>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {payments.map((payment) => (
            <TransactionRow
              key={payment.id}
              payment={payment}
            />
          ))}
        </div>
      </section>

      {/* Model Performance */}

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold tracking-widest text-zinc-600">
                MODEL PERFORMANCE
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                Fraud detection performance
              </h2>

              <p className="mt-2 max-w-xl text-xs leading-6 text-zinc-600">
                These metrics will eventually come from your trained model
                evaluated against a held-out test set.
              </p>
            </div>

            <Link
              href="/risk"
              className="text-xs text-zinc-500 hover:text-white"
            >
              Open risk analytics →
            </Link>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Metric
              label="Precision"
              value="91.4%"
              description="Current model"
            />

            <Metric
              label="Recall"
              value="87.2%"
              description="Current model"
            />

            <Metric
              label="F1 Score"
              value="89.2%"
              description="Current model"
            />

            <Metric
              label="False Positive"
              value="4.8%"
              description="Current model"
            />
          </div>
        </div>
      </section>

      {/* Footer */}

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl justify-between px-6 py-6 text-xs text-zinc-600">
          <span>PaySafe AI</span>
          <span>AI Risk Manager</span>
        </div>
      </footer>
    </main>
  );
}

/* ---------------- Components ---------------- */

function Metric({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs text-zinc-600">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold">
        {value}
      </p>

      <p className="mt-2 text-[10px] text-zinc-700">
        {description}
      </p>
    </div>
  );
}

function RiskResult({
  payment,
}: {
  payment: Payment;
}) {
  const style = riskStyles[payment.riskLevel];

  return (
    <div className="mt-6">
      {/* Score */}

      <div className="rounded-2xl border border-white/10 bg-black p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-600">
              RISK SCORE
            </p>

            <p className="mt-2 text-5xl font-bold">
              {(payment.riskScore * 100).toFixed(0)}
              <span className="text-xl text-zinc-600">
                %
              </span>
            </p>
          </div>

          <RiskBadge level={payment.riskLevel} />
        </div>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-white transition-all"
            style={{
              width: `${payment.riskScore * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Decision */}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <p className="text-[10px] uppercase text-zinc-600">
            Payment
          </p>

          <p className="mt-2 font-mono text-xs text-zinc-300">
            {payment.id}
          </p>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <p className="text-[10px] uppercase text-zinc-600">
            Decision
          </p>

          <p className="mt-2 text-xs font-semibold">
            {payment.status}
          </p>
        </div>
      </div>

      {/* Risk Factors */}

      <div className="mt-6">
        <p className="text-xs font-bold tracking-widest text-zinc-600">
          RISK FACTORS
        </p>

        <div className="mt-3 space-y-2">
          {payment.riskLevel === "HIGH" ? (
            <>
              <RiskFactor text="Transaction amount is unusually high" />
              <RiskFactor text="Transaction requires additional verification" />
              <RiskFactor text="Behavior differs from normal activity" />
            </>
          ) : payment.riskLevel === "MEDIUM" ? (
            <>
              <RiskFactor text="Transaction is above normal range" />
              <RiskFactor text="Additional verification recommended" />
            </>
          ) : (
            <>
              <RiskFactor text="Transaction appears within normal range" />
              <RiskFactor text="No major risk indicators detected" />
            </>
          )}
        </div>
      </div>

      {/* Decision Message */}

      <div
        className={`mt-5 rounded-xl border p-4 ${style.badge}`}
      >
        <p className="text-xs font-semibold">
          {payment.status === "APPROVED"
            ? "Payment approved"
            : payment.status === "REVIEW"
            ? "Manual review recommended"
            : "Payment blocked"}
        </p>

        <p className="mt-1 text-[11px] opacity-70">
          Final decision is currently simulated. The real ML model
          will provide this decision later.
        </p>
      </div>
    </div>
  );
}

function RiskBadge({
  level,
}: {
  level: RiskLevel;
}) {
  const style = riskStyles[level];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${style.badge}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${style.dot}`}
      />

      {level}
    </span>
  );
}

function RiskFactor({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-xs text-zinc-400">
        !
      </span>

      <span className="text-xs text-zinc-400">
        {text}
      </span>
    </div>
  );
}

function TransactionRow({
  payment,
}: {
  payment: Payment;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-white/5 p-5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-mono text-sm font-semibold">
          {payment.id}
        </p>

        <p className="mt-1 text-xs text-zinc-600">
          {payment.amount.toLocaleString()}{" "}
          {payment.currency}
        </p>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-[10px] text-zinc-600">
            Risk
          </p>

          <p className="font-mono text-sm">
            {(payment.riskScore * 100).toFixed(0)}%
          </p>
        </div>

        <RiskBadge level={payment.riskLevel} />

        <div className="hidden text-right sm:block">
          <p className="text-[10px] text-zinc-600">
            Status
          </p>

          <p className="text-xs text-zinc-400">
            {payment.status}
          </p>
        </div>

        <span className="hidden text-[10px] text-zinc-700 sm:block">
          {payment.createdAt}
        </span>
      </div>
    </div>
  );
}