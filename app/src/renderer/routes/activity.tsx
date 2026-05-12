import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity as ActivityIcon,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Repeat,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Activity, ActivityKind, loadActivity, shortAddr } from "@/lib/wallet-store";

export const Route = createFileRoute("/activity")({
  component: ActivityPage,
  head: () => ({
    meta: [
      { title: "Activity — Destrall" },
      { name: "description", content: "Your wallet's transaction history." },
    ],
  }),
});

const FILTERS: { key: "all" | ActivityKind; label: string }[] = [
  { key: "all", label: "All" },
  { key: "send", label: "Sent" },
  { key: "receive", label: "Received" },
  { key: "swap", label: "Swapped" },
];

function ActivityPage() {
  const [items, setItems] = useState<Activity[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  useEffect(() => {
    setItems(loadActivity());
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.kind === filter)),
    [items, filter],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of filtered) {
      const key = new Date(a.timestamp).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

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
          <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        </div>

        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm transition ${
                filter === f.key
                  ? "bg-brand text-brand-foreground font-semibold"
                  : "border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-brand/15 text-brand flex items-center justify-center mb-3">
              <ActivityIcon className="w-6 h-6" />
            </div>
            <p className="font-semibold">No activity yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your transactions will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([day, list]) => (
              <div key={day}>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 px-1">
                  {day}
                </p>
                <div className="rounded-2xl border border-border bg-card/40 backdrop-blur divide-y divide-border overflow-hidden">
                  {list.map((a) => (
                    <ActivityRow key={a.id} item={a} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ActivityRow({ item }: { item: Activity }) {
  const meta = kindMeta(item.kind);
  const Icon = meta.icon;
  const sign = item.kind === "send" ? "-" : item.kind === "receive" ? "+" : "";
  const counterparty =
    item.counterparty.length > 24 ? shortAddr(item.counterparty, 8, 6) : item.counterparty;

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span className={`w-10 h-10 rounded-full flex items-center justify-center ${meta.bg}`}>
        <Icon className={`w-5 h-5 ${meta.color}`} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{meta.title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {item.kind === "send" ? "To " : item.kind === "receive" ? "From " : ""}
          <span className="font-mono">{counterparty}</span>
        </p>
      </div>
      <div className="text-right">
        <p
          className={`text-sm font-semibold ${
            item.kind === "receive" ? "text-brand" : ""
          }`}
        >
          {sign}
          {item.amount} {item.token}
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(item.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

function kindMeta(kind: ActivityKind) {
  switch (kind) {
    case "send":
      return { title: "Sent", icon: ArrowUpRight, bg: "bg-destructive/10", color: "text-destructive" };
    case "receive":
      return { title: "Received", icon: ArrowDownLeft, bg: "bg-brand/15", color: "text-brand" };
    case "swap":
      return { title: "Swapped", icon: Repeat, bg: "bg-secondary", color: "text-foreground" };
  }
}
