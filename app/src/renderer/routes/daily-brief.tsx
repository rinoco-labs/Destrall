import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Wallet,
  Lightbulb,
  Activity as ActivityIcon,
  RefreshCw,
  ChevronDown,
  Sprout,
  ShieldAlert,
  BarChart3,
  Target,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLogo } from "@/components/branding/AppLogo";
import { useWalletStore, getActiveWalletAccount } from "@/stores/walletStore";
import { useNetworkStore } from "@/stores/networkStore";
import { chainQueryScope } from "@/components/network-wallet-query-sync";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { loadDailyBrief } from "../../services/daily-brief/daily-brief.service";
import type { SuiChainEnvironment } from "../../config/chains/sui";

export const Route = createFileRoute("/daily-brief")({
  component: DailyBriefPage,
  head: () => ({
    meta: [
      { title: "Daily Brief — Destrall" },
      {
        name: "description",
        content: "Portfolio, yield, risk, and activity intelligence built from your wallet context.",
      },
    ],
  }),
});

const spotUsdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

function DailyBriefPage() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    overview: true,
    portfolio: true,
    yield: true,
    risk: true,
    market: false,
    activity: false,
    recs: true,
    opps: true,
  });

  const setSection = (key: string, value: boolean) => setOpenSections((s) => ({ ...s, [key]: value }));

  const walletSnap = useWalletStore();
  const activeAccount = useMemo(() => getActiveWalletAccount(walletSnap), [walletSnap]);
  const network = useNetworkStore((s) => s.network);

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

  const brief = briefQuery.data;
  const generatedLabel = brief
    ? new Date(brief.generatedAt).toLocaleString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

  return (
    <AppShell active="home">
      <div className="max-w-3xl mx-auto w-full pb-10">
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/home"
            className="w-9 h-9 rounded-full border border-border bg-secondary/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Daily Brief</h1>
            <p className="text-xs text-muted-foreground truncate">
              {brief ? `For ${brief.accountName} · ${generatedLabel}` : `Generated ${generatedLabel}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void briefQuery.refetch()}
            disabled={briefQuery.isFetching}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 hover:bg-secondary/70 px-4 py-2 text-sm font-medium transition disabled:opacity-60 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${briefQuery.isFetching ? "animate-spin" : ""}`} />
            {briefQuery.isFetching ? "Refreshing" : "Refresh"}
          </button>
        </div>

        {briefQuery.isLoading && (
          <p className="text-sm text-muted-foreground mb-6">Building your brief from balances, Navi, and activity…</p>
        )}
        {briefQuery.isError && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm mb-6">
            {(briefQuery.error as Error)?.message ?? "Could not load Daily Brief."}
          </div>
        )}

        {brief && (
          <>
            <SectionCard
              title="Overview"
              icon={BriefBrandIcon}
              open={openSections.overview}
              onOpenChange={(v) => setSection("overview", v)}
            >
              <ul className="space-y-2 text-sm text-muted-foreground">
                {brief.homeSummaryLines.map((line) => (
                  <li key={line} className="leading-relaxed">
                    {line}
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard
              title="Portfolio insights"
              icon={Wallet}
              open={openSections.portfolio}
              onOpenChange={(v) => setSection("portfolio", v)}
            >
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <Stat label="Total (priced subset)" value={brief.portfolioSummary.totalValueLabel} />
                <Stat
                  label="Diversification score"
                  value={`${brief.portfolioSummary.diversificationScore}/100 (heuristic)`}
                />
                <Stat
                  label="Largest position"
                  value={
                    brief.portfolioSummary.biggestPositionSymbol && brief.portfolioSummary.biggestPositionPct != null
                      ? `${brief.portfolioSummary.biggestPositionSymbol} ~${brief.portfolioSummary.biggestPositionPct.toFixed(0)}%`
                      : "—"
                  }
                />
                <Stat
                  label="Stable allocation"
                  value={
                    brief.portfolioSummary.stableAllocationPct != null
                      ? `~${brief.portfolioSummary.stableAllocationPct.toFixed(0)}%`
                      : "—"
                  }
                />
                <Stat
                  label="Best 24h (priced)"
                  value={
                    brief.portfolioSummary.bestPerformerSymbol && brief.portfolioSummary.bestPerformerPct != null
                      ? `${brief.portfolioSummary.bestPerformerSymbol} ${brief.portfolioSummary.bestPerformerPct >= 0 ? "+" : ""}${brief.portfolioSummary.bestPerformerPct.toFixed(1)}%`
                      : "—"
                  }
                />
                <Stat
                  label="Weakest 24h (priced)"
                  value={
                    brief.portfolioSummary.worstPerformerSymbol && brief.portfolioSummary.worstPerformerPct != null
                      ? `${brief.portfolioSummary.worstPerformerSymbol} ${brief.portfolioSummary.worstPerformerPct.toFixed(1)}%`
                      : "—"
                  }
                />
              </div>
              {brief.portfolioSummary.idleBalances.length > 0 ? (
                <div className="mt-4 rounded-xl border border-border/80 bg-background/40 p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Idle / not in Navi</p>
                  <ul className="text-sm space-y-1">
                    {brief.portfolioSummary.idleBalances.map((r) => (
                      <li key={r.symbol} className="flex justify-between gap-2">
                        <span>
                          {r.symbol} {r.balanceFormatted}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {r.approxUsd != null ? spotUsdFmt.format(r.approxUsd) : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </SectionCard>

            <SectionCard
              title="Yield insights"
              icon={Sprout}
              open={openSections.yield}
              onOpenChange={(v) => setSection("yield", v)}
            >
              {brief.yieldSummary.activePositions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No Navi supply positions in the configured pool set.</p>
              ) : (
                <div className="space-y-2">
                  {brief.yieldSummary.activePositions.map((p) => (
                    <div
                      key={p.symbol}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background/40 px-3 py-2.5 text-sm"
                    >
                      <span className="font-medium">{p.symbol}</span>
                      <span className="text-muted-foreground">
                        Supplied {p.suppliedFormatted} · ~{p.apyPct.toFixed(2)}% APY
                      </span>
                      <span className="text-xs text-muted-foreground w-full sm:w-auto">
                        Est. annual (if USD inferred):{" "}
                        {p.approxUsdAnnualUsd != null ? spotUsdFmt.format(p.approxUsdAnnualUsd) : "—"}
                      </span>
                    </div>
                  ))}
                  {brief.yieldSummary.estimatedAnnualYieldUsd != null ? (
                    <p className="text-xs text-muted-foreground pt-1">
                      Combined rough annualized estimate from positions with a USD mark:{" "}
                      {spotUsdFmt.format(brief.yieldSummary.estimatedAnnualYieldUsd)} — illustrative only.
                    </p>
                  ) : null}
                </div>
              )}
              {brief.yieldSummary.availableOpportunities.length > 0 ? (
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Top pools (context)</p>
                  <div className="space-y-2">
                    {brief.yieldSummary.availableOpportunities.slice(0, 6).map((p) => (
                      <div
                        key={p.symbol}
                        className="rounded-xl border border-border/60 px-3 py-2 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                      >
                        <span className="font-medium">
                          {p.symbol} · {p.supplyApyPct.toFixed(2)}% supply
                        </span>
                        <span className="text-xs text-muted-foreground">{p.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </SectionCard>

            <SectionCard
              title="Risk alerts"
              icon={ShieldAlert}
              open={openSections.risk}
              onOpenChange={(v) => setSection("risk", v)}
            >
              {brief.riskAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No extra heuristic flags beyond your usual profile.</p>
              ) : (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {brief.riskAlerts.map((t) => (
                    <li key={t} className="flex gap-2">
                      <span className="text-brand mt-1">•</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Market context (your holdings only)"
              icon={BarChart3}
              open={openSections.market}
              onOpenChange={(v) => setSection("market", v)}
            >
              <p className="text-sm text-muted-foreground mb-3">{brief.marketSummary.marketSentiment}</p>
              {brief.marketSummary.heldMovers.length > 0 ? (
                <div className="space-y-2">
                  {brief.marketSummary.heldMovers.map((m) => {
                    const up = m.change24hPct > 0;
                    const flat = m.change24hPct === 0;
                    const Trend = up ? TrendingUp : TrendingDown;
                    const color = flat ? "text-muted-foreground" : up ? "text-emerald-400" : "text-rose-400";
                    return (
                      <div key={m.symbol} className="flex items-center justify-between rounded-xl bg-background/40 px-3 py-2">
                        <span className="text-sm font-medium">{m.symbol}</span>
                        <span className={`text-xs inline-flex items-center gap-1 ${color}`}>
                          {!flat && <Trend className="w-3 h-3" />}
                          {flat ? "0.0%" : `${up ? "+" : ""}${m.change24hPct.toFixed(1)}%`} <span className="text-muted-foreground">24h</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No per-token 24h marks on the priced subset.</p>
              )}
            </SectionCard>

            <SectionCard
              title="Recent activity"
              icon={ActivityIcon}
              open={openSections.activity}
              onOpenChange={(v) => setSection("activity", v)}
            >
              <ul className="space-y-2 text-sm text-muted-foreground">
                {brief.activitySummary.map((a) => (
                  <li key={a.summary}>{a.summary}</li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard
              title="Recommendations"
              icon={Lightbulb}
              open={openSections.recs}
              onOpenChange={(v) => setSection("recs", v)}
            >
              <ul className="space-y-2 text-sm">
                {brief.recommendations.map((t) => (
                  <li key={t} className="flex gap-2 text-muted-foreground">
                    <span className="text-brand mt-1">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard
              title="Opportunities"
              icon={Target}
              open={openSections.opps}
              onOpenChange={(v) => setSection("opps", v)}
            >
              {brief.opportunities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No extra prompts — your snapshot looks quiet.</p>
              ) : (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {brief.opportunities.map((t) => (
                    <li key={t} className="flex gap-2">
                      <span className="text-brand mt-1">•</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </>
        )}
      </div>
    </AppShell>
  );
}

function BriefBrandIcon({ className }: { className?: string }) {
  return (
    <span className={className}>
      <AppLogo variant="mark" size="sm" />
    </span>
  );
}

function SectionCard({
  title,
  icon: Icon,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="mb-4">
      <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-secondary/30 transition">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="w-4 h-4 text-brand shrink-0" />
            <span className="font-semibold truncate">{title}</span>
          </div>
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4 pt-0 border-t border-border/60">{children}</CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  );
}
