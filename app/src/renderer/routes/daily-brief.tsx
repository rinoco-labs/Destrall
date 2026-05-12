import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Wallet,
  Lightbulb,
  Activity as ActivityIcon,
  RefreshCw,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/daily-brief")({
  component: DailyBriefPage,
  head: () => ({
    meta: [
      { title: "Daily Brief — Destrall" },
      {
        name: "description",
        content:
          "Full daily portfolio brief: snapshot, movers, risk, and AI-suggested actions.",
      },
    ],
  }),
});

function DailyBriefPage() {
  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setGeneratedAt(new Date());
      setRefreshing(false);
    }, 900);
  };

  const generatedLabel = generatedAt.toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <AppShell active="home">
      <div className="max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/home"
            className="w-9 h-9 rounded-full border border-border bg-secondary/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Daily Brief</h1>
            <p className="text-xs text-muted-foreground">Generated {generatedLabel}</p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 hover:bg-secondary/70 px-4 py-2 text-sm font-medium transition disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>

        {/* Hero summary */}
        <div className="rounded-2xl border border-border bg-card/50 p-6 mb-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-brand/15 text-brand flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Account 1 — Portfolio summary</p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Your portfolio snapshot today is{" "}
              <span className="text-foreground font-medium">$0.00</span> across
              SOL and SUI accounts. No new on-chain activity since your last
              session. Markets are mixed across your tracked assets, with low
              volatility overall.
            </p>
          </div>
        </div>

        {/* Sections grid */}
        <div className="grid sm:grid-cols-2 gap-4 mb-5">
          <Section
            icon={Wallet}
            title="Snapshot"
            items={[
              { label: "Total balance", value: "$0.00" },
              { label: "Accounts", value: "1 active" },
              { label: "Networks", value: "Solana, Sui" },
              { label: "Open positions", value: "0" },
            ]}
          />
          <Section
            icon={ActivityIcon}
            title="24h activity"
            items={[
              { label: "Transactions", value: "0" },
              { label: "Inflows", value: "$0.00" },
              { label: "Outflows", value: "$0.00" },
              { label: "Fees paid", value: "$0.00" },
            ]}
          />
        </div>

        {/* Movers */}
        <div className="rounded-2xl border border-border bg-card/40 p-5 mb-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Top movers
          </p>
          <div className="space-y-2">
            <Mover symbol="SOL" name="Solana" change={2.4} price="$148.20" />
            <Mover symbol="SUI" name="Sui" change={-1.1} price="$3.42" />
            <Mover symbol="USDC" name="USD Coin" change={0.0} price="$1.00" />
          </div>
        </div>

        {/* Risk */}
        <div className="rounded-2xl border border-border bg-card/40 p-5 mb-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold">Security &amp; risk</p>
            <p className="text-sm text-muted-foreground mt-1">
              No suspicious approvals detected. Recovery phrase backup is up to
              date. Auto-lock is enabled.
            </p>
          </div>
        </div>

        {/* Suggestions */}
        <div className="rounded-2xl border border-border bg-card/40 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-brand" />
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Suggested actions
            </p>
          </div>
          <ul className="space-y-2 text-sm">
            <Suggestion text="Fund your Solana account to start tracking real balances and yield." />
            <Suggestion text="Add a contact to send tokens faster next time." />
            <Suggestion text="Explore yield pools available on Sui from the assistant." />
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

function Section({
  icon: Icon,
  title,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-brand" />
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      </div>
      <div className="divide-y divide-border">
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-between py-2 text-sm">
            <span className="text-muted-foreground">{it.label}</span>
            <span className="font-medium">{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Mover({
  symbol,
  name,
  change,
  price,
}: {
  symbol: string;
  name: string;
  change: number;
  price: string;
}) {
  const up = change > 0;
  const flat = change === 0;
  const Trend = up ? TrendingUp : TrendingDown;
  const color = flat
    ? "text-muted-foreground"
    : up
      ? "text-emerald-400"
      : "text-rose-400";
  return (
    <div className="flex items-center justify-between rounded-xl bg-background/40 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-brand/20 text-brand flex items-center justify-center text-xs font-bold">
          {symbol.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">{symbol}</p>
          <p className="text-xs text-muted-foreground leading-tight">{name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">{price}</p>
        <p className={`text-xs inline-flex items-center gap-1 ${color}`}>
          {!flat && <Trend className="w-3 h-3" />}
          {flat ? "0.0%" : `${up ? "+" : ""}${change.toFixed(1)}%`}
        </p>
      </div>
    </div>
  );
}

function Suggestion({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
      <span className="text-muted-foreground">{text}</span>
    </li>
  );
}
