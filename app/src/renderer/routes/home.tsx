import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { useWalletStore, getActiveWalletAccount } from "@/stores/walletStore";
import { useNetworkStore } from "@/stores/networkStore";
import { desktopGetChainBalances } from "@/lib/desktopChain";
import { shortAddr } from "@/lib/wallet-store";
import { chainQueryScope } from "@/components/network-wallet-query-sync";
import { loadDailyBrief } from "../../services/daily-brief/daily-brief.service";
import type { SuiChainEnvironment } from "../../config/chains/sui";

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

const usdTotalFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

/** Sum `TokenBalanceView.usdValue` strings from {@link Intl.NumberFormat} en-US currency output. */
function sumUsdValues(rows: { usdValue?: string }[]): number | null {
  let sum = 0;
  let n = 0;
  for (const b of rows) {
    if (!b.usdValue) continue;
    const v = Number.parseFloat(b.usdValue.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(v)) {
      sum += v;
      n += 1;
    }
  }
  return n > 0 ? sum : null;
}

function Home() {
  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const walletSnap = useWalletStore();
  const activeAccount = useMemo(() => getActiveWalletAccount(walletSnap), [walletSnap]);
  const network = useNetworkStore((s) => s.network);

  const balancesQuery = useQuery({
    queryKey: [
      ...chainQueryScope,
      "balances",
      activeAccount?.id ?? "",
      network?.activeEnvironment ?? "",
    ],
    queryFn: async () => {
      if (!activeAccount) return [];
      return desktopGetChainBalances(activeAccount.id);
    },
    enabled: Boolean(activeAccount?.id && network),
  });

  const briefQuery = useQuery({
    queryKey: [
      ...chainQueryScope,
      "daily-brief-v2",
      activeAccount?.id ?? "",
      network?.activeEnvironment ?? "",
    ],
    queryFn: async () => {
      if (!activeAccount || !network) {
        throw new Error("Missing account or network");
      }
      return loadDailyBrief({
        accountId: activeAccount.id,
        accountName: activeAccount.name,
        isSuiAccount: activeAccount.chain === "sui",
        suiEnvironment: network.activeEnvironment as SuiChainEnvironment,
        networkLabel: `${network.activeChain} · ${network.activeEnvironment}`,
      });
    },
    enabled: Boolean(activeAccount?.id && network),
    staleTime: 15 * 60 * 1000,
  });

  const refresh = async () => {
    setGeneratedAt(new Date());
    await Promise.all([balancesQuery.refetch(), briefQuery.refetch()]);
  };

  const rows = balancesQuery.data ?? [];
  const totalUsd = useMemo(() => sumUsdValues(rows), [rows]);
  const pricedCount = useMemo(() => rows.filter((b) => b.usdValue).length, [rows]);

  return (
    <AppShell active="home">
      <div className="text-center mb-6">
        {activeAccount && (
          <p className="text-xs text-muted-foreground font-mono mb-1">
            {shortAddr(activeAccount.address, 8, 8)}
          </p>
        )}
        {network && (
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            {network.activeChain} · {network.activeEnvironment}
          </p>
        )}
        <p className="text-sm text-muted-foreground">Total balance</p>
        <p className="text-5xl font-bold mt-1 tabular-nums">
          {balancesQuery.isLoading ? "…" : totalUsd != null ? usdTotalFmt.format(totalUsd) : "—"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {balancesQuery.isLoading
            ? "Loading on-chain balances…"
            : network?.activeEnvironment === "devnet"
              ? "USD estimates unavailable on Sui Devnet — token amounts below."
              : totalUsd != null
                ? `${pricedCount === rows.length ? "All" : `${pricedCount} of ${rows.length}`} assets priced via Aftermath.`
                : rows.length > 0
                  ? "No USD quote from Aftermath for these tokens — amounts below."
                  : "USD value appears once you hold tokens with a listed price."}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card/50 hover:border-brand/40 transition p-5 sm:p-6 mb-6 flex items-start gap-4 group min-h-[148px]">
        <div className="w-11 h-11 rounded-xl bg-brand/15 text-brand flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">Daily Brief</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={balancesQuery.isRefetching || briefQuery.isRefetching}
                aria-label="Refresh balances and brief"
                className="w-7 h-7 rounded-full hover:bg-secondary/60 text-muted-foreground hover:text-foreground inline-flex items-center justify-center transition disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${balancesQuery.isRefetching || briefQuery.isRefetching ? "animate-spin" : ""}`}
                />
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
            Generated{" "}
            {formatGenerated(new Date(briefQuery.data?.generatedAt ?? generatedAt.getTime()))}
          </p>
          {briefQuery.isLoading ? (
            <p className="text-sm text-muted-foreground text-left">Building your personalized brief…</p>
          ) : briefQuery.isError ? (
            <p className="text-sm text-destructive text-left">
              {(briefQuery.error as Error)?.message ?? "Brief unavailable."}
            </p>
          ) : (
            <ul className="text-sm text-muted-foreground text-left space-y-1.5 leading-snug">
              {(briefQuery.data?.homeSummaryLines ?? []).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {(
          [
            { label: "Send", icon: Send, to: "/send" },
            { label: "Receive", icon: ReceiveIcon, to: "/receive" },
            { label: "Contacts", icon: Users, to: "/contacts" },
            { label: "Activity", icon: Activity, to: "/activity" },
          ] as const
        ).map(({ label, icon: Icon, to }) => (
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
        {balancesQuery.isLoading && (
          <div className="p-5 text-sm text-muted-foreground">Loading balances…</div>
        )}
        {balancesQuery.isError && (
          <div className="p-5 text-sm text-destructive">
            {(balancesQuery.error as Error)?.message ?? "Failed to load balances"}
          </div>
        )}
        {!balancesQuery.isLoading && !balancesQuery.isError && (balancesQuery.data?.length ?? 0) === 0 && (
          <div className="p-5 text-sm text-muted-foreground">No token balances on this account yet.</div>
        )}
        {(balancesQuery.data ?? []).map((b) => (
          <div key={b.coinType} className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{b.symbol}</p>
            <p className="text-lg font-semibold mt-1">
              {b.balanceFormatted} {b.symbol}
            </p>
            {b.usdValue ? (
              <p className="text-sm text-muted-foreground mt-0.5 tabular-nums">≈ {b.usdValue}</p>
            ) : null}
            <p className="text-xs text-muted-foreground font-mono truncate">{b.coinType}</p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
