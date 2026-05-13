import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { useWalletStore, getActiveWalletAccount } from "@/stores/walletStore";
import { useNetworkStore } from "@/stores/networkStore";
import { desktopGetChainBalances, desktopGetChainActivity } from "@/lib/desktopChain";
import type { ChainActivityItem, TokenBalanceView } from "../../types/blockchain";
import { chainQueryScope } from "@/components/network-wallet-query-sync";

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

const MS_24H = 24 * 60 * 60 * 1000;

const usdTotalFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const spotUsdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

function sumUsdValues(rows: Pick<TokenBalanceView, "usdValue">[]): number | null {
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

function activityInLast24h(items: ChainActivityItem[]): ChainActivityItem[] {
  const cutoff = Date.now() - MS_24H;
  return items.filter((i) => i.timestamp != null && i.timestamp >= cutoff);
}

function countPositiveBalanceTokens(rows: TokenBalanceView[]): number {
  let c = 0;
  for (const b of rows) {
    try {
      if (BigInt(b.balanceRaw) > 0n) c += 1;
    } catch {
      /* ignore */
    }
  }
  return c;
}

function DailyBriefPage() {
  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const walletSnap = useWalletStore();
  const activeAccount = useMemo(() => getActiveWalletAccount(walletSnap), [walletSnap]);
  const network = useNetworkStore((s) => s.network);

  const briefQuery = useQuery({
    queryKey: [
      ...chainQueryScope,
      "daily-brief",
      activeAccount?.id ?? "",
      network?.activeEnvironment ?? "",
    ],
    queryFn: async () => {
      if (!activeAccount) {
        return { balances: [] as TokenBalanceView[], activityItems: [] as ChainActivityItem[] };
      }
      const [balances, activity] = await Promise.all([
        desktopGetChainBalances(activeAccount.id),
        desktopGetChainActivity({ accountId: activeAccount.id }),
      ]);
      return { balances, activityItems: activity.items };
    },
    enabled: Boolean(activeAccount?.id && network),
  });

  const rows = briefQuery.data?.balances ?? [];
  const totalUsd = useMemo(() => sumUsdValues(rows), [rows]);
  const pricedCount = useMemo(() => rows.filter((b) => b.usdValue).length, [rows]);
  const positiveTokens = useMemo(() => countPositiveBalanceTokens(rows), [rows]);

  const activity24h = useMemo(
    () => activityInLast24h(briefQuery.data?.activityItems ?? []),
    [briefQuery.data?.activityItems],
  );

  const activityStats = useMemo(() => {
    const txs = activity24h.length;
    let receives = 0;
    let sends = 0;
    for (const a of activity24h) {
      if (a.type === "receive") receives += 1;
      else if (a.type === "send") sends += 1;
    }
    return { txs, receives, sends };
  }, [activity24h]);

  const movers = useMemo(() => {
    const priced = rows.filter((b) => b.usdPricePerUnit != null && Number.isFinite(b.usdPricePerUnit));
    return [...priced].sort((a, b) => {
      const da = Math.abs(a.usdPriceChange24hPct ?? 0);
      const db = Math.abs(b.usdPriceChange24hPct ?? 0);
      return db - da;
    });
  }, [rows]);

  const refresh = async () => {
    setGeneratedAt(new Date());
    await briefQuery.refetch();
  };

  const generatedLabel = generatedAt.toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const isSuiAccount = activeAccount?.chain === "sui";
  const devnetNoPrices = network?.activeEnvironment === "devnet";

  const heroParagraph = (() => {
    if (!activeAccount) {
      return "Unlock your wallet and pick an account to see a live portfolio summary.";
    }
    if (!isSuiAccount) {
      return "Daily Brief pricing and balances use your Sui account. Switch to a Sui account on Home for on-chain totals.";
    }
    if (!network) {
      return "Loading network settings…";
    }
    if (briefQuery.isLoading) {
      return "Loading your on-chain balances and recent activity…";
    }
    if (briefQuery.isError) {
      return (briefQuery.error as Error)?.message ?? "Could not load wallet data. Check the network and try refresh.";
    }
    const total =
      totalUsd != null ? usdTotalFmt.format(totalUsd) : devnetNoPrices ? "— (devnet)" : "—";
    const netLabel = network
      ? `${network.activeChain} · ${network.activeEnvironment}`
      : "current network";
    const pricedLine =
      rows.length === 0
        ? "No token balances detected on this address yet."
        : totalUsd != null
          ? `${pricedCount === rows.length ? "All" : `${pricedCount} of ${rows.length}`} held assets have a USD quote from Aftermath.`
          : devnetNoPrices
            ? "USD quotes from Aftermath are unavailable on Sui Devnet."
            : "None of the detected tokens returned a USD quote from Aftermath.";
    const act =
      activityStats.txs === 0
        ? "No transactions in the latest history within the last 24 hours (first page of activity)."
        : `${activityStats.txs} transaction(s) with timestamps in the last 24 hours in your recent activity feed.`;
    return (
      <>
        Portfolio total about <span className="text-foreground font-medium">{total}</span> on{" "}
        <span className="text-foreground font-medium">{netLabel}</span> for{" "}
        <span className="text-foreground font-medium">{activeAccount.name}</span>. {pricedLine} {act}
      </>
    );
  })();

  const suggestions = useMemo(() => {
    const out: string[] = [];
    if (!activeAccount) {
      out.push("Unlock Destrall and select an account to personalize this brief.");
      return out;
    }
    if (!isSuiAccount) {
      out.push("Create or switch to a Sui account to track balances and Aftermath prices here.");
      return out;
    }
    if (rows.length === 0) {
      out.push("Receive SUI or other Sui tokens to this address to start building a portfolio view.");
    }
    if (rows.length > 0 && pricedCount < rows.length && !devnetNoPrices) {
      out.push("Some held tokens have no Aftermath USD quote — amounts still show on Home.");
    }
    if (activityStats.txs === 0 && rows.length > 0) {
      out.push("No recent 24h activity in the first history page — open Activity for the full feed.");
    }
    out.push("Ask the assistant about Navi yield on Sui when you want to put idle assets to work.");
    return out;
  }, [
    activeAccount,
    isSuiAccount,
    rows.length,
    pricedCount,
    devnetNoPrices,
    activityStats.txs,
  ]);

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
            onClick={() => void refresh()}
            disabled={briefQuery.isFetching}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 hover:bg-secondary/70 px-4 py-2 text-sm font-medium transition disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${briefQuery.isFetching ? "animate-spin" : ""}`} />
            {briefQuery.isFetching ? "Refreshing" : "Refresh"}
          </button>
        </div>

        {/* Hero summary */}
        <div className="rounded-2xl border border-border bg-card/50 p-6 mb-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-brand/15 text-brand flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">
              {activeAccount ? `${activeAccount.name} — Portfolio summary` : "Portfolio summary"}
            </p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{heroParagraph}</p>
          </div>
        </div>

        {/* Sections grid */}
        <div className="grid sm:grid-cols-2 gap-4 mb-5">
          <Section
            icon={Wallet}
            title="Snapshot"
            items={[
              {
                label: "Total balance",
                value:
                  briefQuery.isLoading && isSuiAccount
                    ? "…"
                    : totalUsd != null
                      ? usdTotalFmt.format(totalUsd)
                      : "—",
              },
              {
                label: "Account",
                value: activeAccount ? activeAccount.name : "—",
              },
              {
                label: "Network",
                value: network
                  ? `${network.activeChain} · ${network.activeEnvironment}`
                  : "—",
              },
              {
                label: "Tokens (non-zero)",
                value: briefQuery.isLoading && isSuiAccount ? "…" : String(positiveTokens),
              },
            ]}
          />
          <Section
            icon={ActivityIcon}
            title="24h activity"
            subtitle="From the first page of your activity feed"
            items={[
              {
                label: "Transactions (24h)",
                value:
                  briefQuery.isLoading && isSuiAccount
                    ? "…"
                    : String(activityStats.txs),
              },
              {
                label: "Receive events",
                value:
                  briefQuery.isLoading && isSuiAccount
                    ? "…"
                    : String(activityStats.receives),
              },
              {
                label: "Send events",
                value:
                  briefQuery.isLoading && isSuiAccount
                    ? "…"
                    : String(activityStats.sends),
              },
              { label: "Fees paid (est.)", value: "—" },
            ]}
          />
        </div>

        {/* Movers */}
        <div className="rounded-2xl border border-border bg-card/40 p-5 mb-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Top movers (your holdings)
          </p>
          <p className="text-[11px] text-muted-foreground mb-3">
            Spot price and 24h % from Aftermath{" "}
            <a
              href="https://docs.aftermath.finance/for-developers/typescript-sdk/products/prices"
              target="_blank"
              rel="noreferrer"
              className="text-brand hover:underline"
            >
              Prices API
            </a>
            . 24h % may show as 0 when Aftermath does not expose that series yet.
          </p>
          <div className="space-y-2">
            {briefQuery.isLoading && isSuiAccount ? (
              <p className="text-sm text-muted-foreground py-2">Loading quotes…</p>
            ) : !isSuiAccount ? (
              <p className="text-sm text-muted-foreground py-2">
                Switch to a Sui account to see Aftermath prices for your tokens.
              </p>
            ) : movers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                {rows.length === 0
                  ? "No balances to rank yet."
                  : "No Aftermath USD quotes for the tokens you hold on this network."}
              </p>
            ) : (
              movers.slice(0, 6).map((b) => (
                <Mover
                  key={b.coinType}
                  symbol={b.symbol}
                  name={b.symbol}
                  change={b.usdPriceChange24hPct ?? 0}
                  price={spotUsdFmt.format(b.usdPricePerUnit ?? 0)}
                />
              ))
            )}
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
              This brief uses read-only chain data in Destrall. Keep your recovery phrase offline; never
              paste it into chat or unknown sites. Prefer hardware or OS-backed protection for high-value
              keys.
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
            {suggestions.map((text) => (
              <Suggestion key={text} text={text} />
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  items: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-brand" />
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
        </div>
        {subtitle ? (
          <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>
        ) : null}
      </div>
      <div className="divide-y divide-border">
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-between py-2 text-sm">
            <span className="text-muted-foreground">{it.label}</span>
            <span className="font-medium text-right pl-2">{it.value}</span>
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
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-brand/20 text-brand flex items-center justify-center text-xs font-bold shrink-0">
          {symbol.charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">{symbol}</p>
          <p className="text-xs text-muted-foreground leading-tight truncate">{name}</p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium tabular-nums">{price}</p>
        <p className={`text-xs inline-flex items-center gap-1 justify-end ${color}`}>
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
