import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity as ActivityIcon,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  RefreshCw,
  Repeat,
  ExternalLink,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { shortAddr } from "@/lib/wallet-store";
import { useWalletStore, getActiveWalletAccount } from "@/stores/walletStore";
import { useNetworkStore } from "@/stores/networkStore";
import { desktopGetChainActivity } from "@/lib/desktopChain";
import type { ChainActivityItem } from "../../types/blockchain";
import { chainQueryScope } from "@/components/network-wallet-query-sync";

export const Route = createFileRoute("/activity")({
  component: ActivityPage,
  head: () => ({
    meta: [
      { title: "Activity — Destrall" },
      { name: "description", content: "Your wallet's transaction history." },
    ],
  }),
});

const FILTERS: { key: "all" | ChainActivityItem["type"]; label: string }[] = [
  { key: "all", label: "All" },
  { key: "send", label: "Sent" },
  { key: "receive", label: "Received" },
  { key: "swap", label: "Swapped" },
  { key: "transaction", label: "Other" },
];

function ActivityPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const walletSnap = useWalletStore();
  const activeAccount = useMemo(() => getActiveWalletAccount(walletSnap), [walletSnap]);
  const network = useNetworkStore((s) => s.network);

  const activityQuery = useQuery({
    queryKey: [
      ...chainQueryScope,
      "activity",
      activeAccount?.id ?? "",
      network?.activeEnvironment ?? "",
    ],
    queryFn: async () => {
      if (!activeAccount) return { items: [], nextCursor: null };
      return desktopGetChainActivity({ accountId: activeAccount.id });
    },
    enabled: Boolean(activeAccount?.id && network),
  });

  const items = activityQuery.data?.items ?? [];

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.type === filter)),
    [items, filter],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ChainActivityItem[]>();
    for (const a of filtered) {
      const ts = a.timestamp ?? 0;
      const key = new Date(ts).toLocaleDateString(undefined, {
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
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Link
              to="/home"
              className="w-9 h-9 rounded-full border border-border bg-secondary/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
          </div>
          <button
            type="button"
            onClick={() => void activityQuery.refetch()}
            disabled={activityQuery.isRefetching}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary/50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${activityQuery.isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {network && (
          <p className="text-xs text-muted-foreground mb-4">
            Network: {network.activeChain} · {network.activeEnvironment}
          </p>
        )}

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

        {activityQuery.isLoading && (
          <div className="rounded-2xl border border-border bg-card/30 p-8 text-center text-sm text-muted-foreground">
            Loading activity…
          </div>
        )}
        {activityQuery.isError && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center text-sm text-destructive">
            {(activityQuery.error as Error)?.message ?? "Could not load activity"}
          </div>
        )}
        {!activityQuery.isLoading && !activityQuery.isError && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-brand/15 text-brand flex items-center justify-center mb-3">
              <ActivityIcon className="w-6 h-6" />
            </div>
            <p className="font-semibold">No matching activity</p>
            <p className="text-sm text-muted-foreground mt-1">
              On-chain transactions involving this address will show here.
            </p>
          </div>
        )}
        {!activityQuery.isLoading && filtered.length > 0 && (
          <div className="space-y-6">
            {grouped.map(([day, list]) => (
              <div key={day}>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 px-1">{day}</p>
                <div className="rounded-2xl border border-border bg-card/40 backdrop-blur divide-y divide-border overflow-hidden">
                  {list.map((a) => (
                    <ActivityRow key={a.digest} item={a} />
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

function ActivityRow({ item }: { item: ChainActivityItem }) {
  const meta = kindMeta(item.type);
  const Icon = meta.icon;
  const sign = item.type === "send" ? "-" : item.type === "receive" ? "+" : "";
  const counterparty =
    item.type === "send"
      ? item.recipient
        ? shortAddr(item.recipient, 8, 6)
        : "—"
      : item.type === "receive"
        ? item.sender
          ? shortAddr(item.sender, 8, 6)
          : "—"
        : shortAddr(item.digest, 6, 4);

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span className={`w-10 h-10 rounded-full flex items-center justify-center ${meta.bg}`}>
        <Icon className={`w-5 h-5 ${meta.color}`} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{meta.title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {item.type === "send" ? "To " : item.type === "receive" ? "From " : ""}
          <span className="font-mono">{counterparty}</span>
        </p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
          {item.status}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-semibold ${item.type === "receive" ? "text-brand" : ""}`}>
          {item.amount ? `${sign}${item.amount} ${item.symbol ?? ""}` : item.type}
        </p>
        <p className="text-xs text-muted-foreground">
          {item.timestamp
            ? new Date(item.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—"}
        </p>
        {item.explorerUrl && (
          <a
            href={item.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-[10px] text-brand mt-1"
          >
            Explorer
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function kindMeta(type: string) {
  switch (type) {
    case "send":
      return { title: "Sent", icon: ArrowUpRight, bg: "bg-destructive/10", color: "text-destructive" };
    case "receive":
      return { title: "Received", icon: ArrowDownLeft, bg: "bg-brand/15", color: "text-brand" };
    case "swap":
      return { title: "Swapped", icon: Repeat, bg: "bg-secondary", color: "text-foreground" };
    default:
      return { title: "Transaction", icon: ActivityIcon, bg: "bg-secondary", color: "text-foreground" };
  }
}
