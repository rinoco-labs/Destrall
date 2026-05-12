import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Download as ReceiveIcon,
  Send,
  Users,
  Sparkles,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/home")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Destrall — Home" },
      { name: "description", content: "Your multi-chain account dashboard." },
    ],
  }),
});

function formatGenerated(date: Date) {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "just now";
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function Home() {
  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setGeneratedAt(new Date());
      setRefreshing(false);
    }, 800);
  };

  return (
    <AppShell active="home">
      <div className="text-center mb-8">
        <p className="text-sm text-muted-foreground">Total Balance</p>
        <p className="text-5xl font-bold mt-1">$0.00</p>
        <p className="text-xs text-muted-foreground mt-1">Live on-chain balances</p>
      </div>

      <div className="rounded-2xl border border-border bg-card/50 hover:border-brand/40 transition p-5 mb-6 flex items-start gap-4 group">
        <div className="w-10 h-10 rounded-xl bg-brand/15 text-brand flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">Daily Brief</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing}
                aria-label="Refresh daily brief"
                className="w-7 h-7 rounded-full hover:bg-secondary/60 text-muted-foreground hover:text-foreground inline-flex items-center justify-center transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <Link
                to="/daily-brief"
                className="text-xs text-brand inline-flex items-center gap-0.5 px-2 py-1 rounded-full hover:bg-brand/10 transition"
              >
                View full
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Generated {formatGenerated(generatedAt)}
          </p>
          <p className="text-sm text-muted-foreground line-clamp-1">
            Portfolio steady at $0.00 — no new activity, low volatility today.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {([
          { label: "Send", icon: Send, to: "/send" },
          { label: "Receive", icon: ReceiveIcon, to: "/receive" },
          { label: "Contacts", icon: Users, to: "/contacts" },
          { label: "Activity", icon: Activity, to: "/activity" },
        ] as const).map(({ label, icon: Icon, to }) => (
          <Link
            key={label}
            to={to}
            className="rounded-2xl border border-border bg-card/40 hover:bg-secondary/40 transition p-5 flex flex-col items-center gap-2"
          >
            <Icon className="w-5 h-5 text-brand" />
            <span className="text-sm font-medium">{label}</span>
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card/40 divide-y divide-border">
        {[
          { chain: "SOLANA", amount: "0 SOL" },
          { chain: "SUI", amount: "0 SUI" },
        ].map((b) => (
          <div key={b.chain} className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{b.chain}</p>
            <p className="text-lg font-semibold mt-1">{b.amount}</p>
            <p className="text-sm text-muted-foreground">No token balances</p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
