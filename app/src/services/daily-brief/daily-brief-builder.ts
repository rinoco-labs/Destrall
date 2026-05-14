import type { DailyBrief, DailyBriefBuildInput } from "./daily-brief-types";
import { buildMarketSummaryFromHoldings } from "./daily-brief-market";
import { buildRiskAlerts } from "./daily-brief-risk";
import { buildOpportunityLines } from "./daily-brief-opportunities";
import { buildPersonalizedRecommendations, extractPortfolioAnalysisScores } from "./daily-brief-insights";
import type { TokenBalanceView, ChainActivityItem } from "../../types/blockchain";
import type { NaviPoolRow, NaviPositionView } from "../../packages/core/yield/navi/navi.types";
import type { SuiChainEnvironment } from "../../config/chains/sui";
import { type YieldRiskProfile, isLikelyStablecoin } from "../../packages/core/yield/navi/navi-risk.heuristics";

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

function parseUsd(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function positiveRaw(balanceRaw: string): boolean {
  try {
    return BigInt(balanceRaw || "0") > 0n;
  } catch {
    return false;
  }
}

function sumUsd(rows: TokenBalanceView[]): number | null {
  let s = 0;
  let n = 0;
  for (const b of rows) {
    const v = parseUsd(b.usdValue);
    if (v != null) {
      s += v;
      n += 1;
    }
  }
  return n > 0 ? s : null;
}

function buildActivityLines(items: ChainActivityItem[]): DailyBrief["activitySummary"] {
  const MS_24H = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const sorted = [...items].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  const in24 = items.filter((i) => i.timestamp != null && i.timestamp >= now - MS_24H);

  const lines: DailyBrief["activitySummary"] = [];

  if (in24.length === 0) {
    lines.push({
      kind: "none",
      summary: "No send/receive activity in the last 24h on the first page of your feed.",
      timestamp: null,
    });
  } else {
    lines.push({
      kind: "other",
      summary: `${in24.length} send/receive line(s) in the last 24h on the first activity page.`,
      timestamp: in24[0]?.timestamp ?? null,
    });
  }

  const lastSend = sorted.find((i) => i.type === "send");
  if (lastSend?.amount && lastSend.symbol) {
    lines.push({
      kind: "send",
      summary: `Last send: ${lastSend.amount} ${lastSend.symbol}.`,
      timestamp: lastSend.timestamp,
    });
  }

  const lastRecv = sorted.find((i) => i.type === "receive");
  if (lastRecv?.amount && lastRecv.symbol) {
    lines.push({
      kind: "receive",
      summary: `Last receive: ${lastRecv.amount} ${lastRecv.symbol}.`,
      timestamp: lastRecv.timestamp,
    });
  }

  return lines.slice(0, 5);
}

function portfolioSummaryFrom(
  balances: TokenBalanceView[],
  positions: NaviPositionView[],
  diversificationScore: number,
  devnetNoPrices: boolean,
): DailyBrief["portfolioSummary"] {
  const totalValueUsd = sumUsd(balances);
  const priced = balances
    .map((b) => ({ b, usd: parseUsd(b.usdValue), chg: b.usdPriceChange24hPct }))
    .filter((x) => x.usd != null) as { b: TokenBalanceView; usd: number; chg?: number }[];

  let biggestPositionSymbol: string | null = null;
  let biggestPositionPct: number | null = null;
  let bestPerformerSymbol: string | null = null;
  let bestPerformerPct: number | null = null;
  let worstPerformerSymbol: string | null = null;
  let worstPerformerPct: number | null = null;
  let stableAllocationPct: number | null = null;

  if (priced.length > 0) {
    const total = priced.reduce((s, x) => s + x.usd, 0);
    const sortedW = [...priced].sort((a, b) => b.usd - a.usd);
    const top = sortedW[0];
    biggestPositionSymbol = top.b.symbol;
    biggestPositionPct = (top.usd / total) * 100;

    const stableUsd = priced.filter(({ b }) => isLikelyStablecoin(b.symbol)).reduce((s, x) => s + x.usd, 0);
    stableAllocationPct = (stableUsd / total) * 100;

    const withChg = priced.filter((x) => x.chg != null && Number.isFinite(x.chg));
    if (withChg.length) {
      const best = [...withChg].sort((a, b) => (b.chg ?? 0) - (a.chg ?? 0))[0];
      const worst = [...withChg].sort((a, b) => (a.chg ?? 0) - (b.chg ?? 0))[0];
      bestPerformerSymbol = best.b.symbol;
      bestPerformerPct = best.chg ?? null;
      worstPerformerSymbol = worst.b.symbol;
      worstPerformerPct = worst.chg ?? null;
    }
  }

  const naviSyms = new Set(positions.map((p) => p.assetSymbol.toUpperCase()));

  const idleBalances = (() => {
    const rows: DailyBrief["portfolioSummary"]["idleBalances"] = [];
    for (const b of balances) {
      if (!positiveRaw(b.balanceRaw)) continue;
      const sym = b.symbol.toUpperCase();
      if (isLikelyStablecoin(b.symbol) && !naviSyms.has(sym)) {
        rows.push({
          symbol: b.symbol,
          balanceFormatted: b.balanceFormatted,
          approxUsd: parseUsd(b.usdValue),
        });
      } else if (sym === "SUI" && !naviSyms.has("SUI") && parseUsd(b.usdValue) != null && (parseUsd(b.usdValue) ?? 0) > 10) {
        rows.push({
          symbol: b.symbol,
          balanceFormatted: b.balanceFormatted,
          approxUsd: parseUsd(b.usdValue),
        });
      }
    }
    return rows.slice(0, 8);
  })();

  return {
    totalValueUsd,
    totalValueLabel:
      totalValueUsd != null ? usdFmt.format(totalValueUsd) : devnetNoPrices ? "— (devnet)" : "—",
    biggestPositionSymbol,
    biggestPositionPct,
    bestPerformerSymbol,
    bestPerformerPct,
    worstPerformerSymbol,
    worstPerformerPct,
    stableAllocationPct,
    diversificationScore,
    idleBalances,
  };
}

function yieldSummaryFrom(
  balances: TokenBalanceView[],
  pools: NaviPoolRow[],
  positions: NaviPositionView[],
  suiEnvironment: DailyBriefBuildInput["suiEnvironment"],
): DailyBrief["yieldSummary"] {
  const activePositions = positions.map((p) => {
    const row = balances.find((b) => b.symbol.toUpperCase() === p.assetSymbol.toUpperCase());
    const usdPer = row?.usdPricePerUnit;
    const n = Number.parseFloat(String(p.suppliedFormatted).replace(/,/g, ""));
    let approxUsdAnnualUsd: number | null = null;
    if (Number.isFinite(n) && usdPer != null && Number.isFinite(usdPer)) {
      const approx = n * usdPer * (p.apy / 100);
      approxUsdAnnualUsd = Number.isFinite(approx) ? approx : null;
    }
    return {
      symbol: p.assetSymbol,
      suppliedFormatted: p.suppliedFormatted,
      apyPct: p.apy,
      risk: p.risk,
      approxUsdAnnualUsd,
    };
  });

  let estimatedAnnualYieldUsd: number | null = null;
  const parts = activePositions.map((p) => p.approxUsdAnnualUsd).filter((x): x is number => x != null && Number.isFinite(x));
  if (parts.length) {
    estimatedAnnualYieldUsd = parts.reduce((a, b) => a + b, 0);
  }

  let highestApySymbol: string | null = null;
  let highestApyPct: number | null = null;
  if (pools.length) {
    const top = [...pools].sort((a, b) => b.supplyApy - a.supplyApy)[0];
    highestApySymbol = top.symbol;
    highestApyPct = top.supplyApy;
  }

  const heldSyms = new Set(balances.map((b) => b.symbol.toUpperCase()));
  const availableOpportunities = pools
    .filter((p) => heldSyms.has(p.symbol.toUpperCase()) || isLikelyStablecoin(p.symbol))
    .sort((a, b) => b.supplyApy - a.supplyApy)
    .slice(0, 8)
    .map((p) => ({
      symbol: p.symbol,
      supplyApyPct: p.supplyApy,
      risk: p.risk,
      reason: heldSyms.has(p.symbol.toUpperCase())
        ? "You hold this asset in the wallet — pool APY is relevant if you deploy supply."
        : "Stable-type pool — may suit idle stable balances.",
    }));

  if (suiEnvironment !== "mainnet") {
    return {
      activePositions,
      availableOpportunities: [],
      highestApySymbol,
      highestApyPct,
      estimatedAnnualYieldUsd,
    };
  }

  return {
    activePositions,
    availableOpportunities,
    highestApySymbol,
    highestApyPct,
    estimatedAnnualYieldUsd,
  };
}

function buildHomeLines(brief: DailyBrief): string[] {
  const lines: string[] = [];
  const ps = brief.portfolioSummary;
  const ys = brief.yieldSummary;

  lines.push(`Your portfolio is about ${ps.totalValueLabel} on ${brief.networkLabel}.`);

  if (ps.biggestPositionSymbol && ps.biggestPositionPct != null) {
    lines.push(`${ps.biggestPositionSymbol} is your largest priced line at ~${ps.biggestPositionPct.toFixed(0)}% of that subset.`);
  }

  if (ys.activePositions.length) {
    const apyList = ys.activePositions.map((p) => `${p.symbol} ~${p.apyPct.toFixed(2)}%`).join(", ");
    lines.push(
      `${ys.activePositions.length} active Navi supply position(s): ${apyList}.`,
    );
  } else if (brief.suiEnvironment === "mainnet") {
    lines.push("No Navi supply positions detected for configured pools on this address.");
  }

  if (ys.highestApySymbol && ys.highestApyPct != null && brief.suiEnvironment === "mainnet") {
    lines.push(`Highest headline supply APY in the current Navi snapshot: ${ys.highestApySymbol} ~${ys.highestApyPct.toFixed(2)}%.`);
  }

  if (brief.opportunities[0]) {
    lines.push(brief.opportunities[0]);
  }

  if (brief.riskAlerts[0]) {
    lines.push(brief.riskAlerts[0]);
  } else if (brief.marketSummary.trend !== "unknown") {
    lines.push(brief.marketSummary.marketSentiment);
  }

  const clipped = lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  return clipped.slice(0, 6);
}

export function buildDailyBrief(input: DailyBriefBuildInput): DailyBrief {
  const { balances, activityItems, chainBundle, accountId, accountName, isSuiAccount, suiEnvironment, networkLabel } =
    input;
  const devnetNoPrices = suiEnvironment === "devnet";
  const pricedTokenCount = balances.filter((b) => b.usdValue).length;

  const analysis = extractPortfolioAnalysisScores(
    balances,
    chainBundle.riskProfile,
    suiEnvironment,
    chainBundle.positions,
    chainBundle.pools,
  );

  const marketSummary = buildMarketSummaryFromHoldings(balances);
  const portfolioSummary = portfolioSummaryFrom(
    balances,
    chainBundle.positions,
    analysis.diversificationScore,
    devnetNoPrices,
  );
  const yieldSummary = yieldSummaryFrom(balances, chainBundle.pools, chainBundle.positions, suiEnvironment);
  const riskAlerts = buildRiskAlerts({
    balances,
    positions: chainBundle.positions,
    riskProfile: chainBundle.riskProfile,
  });
  const opportunities = buildOpportunityLines({
    balances,
    pools: chainBundle.pools,
    positions: chainBundle.positions,
    riskProfile: chainBundle.riskProfile,
    suiEnvironment,
  });
  const recommendations = buildPersonalizedRecommendations({
    balances,
    pools: chainBundle.pools,
    positions: chainBundle.positions,
    riskProfile: chainBundle.riskProfile,
    suiEnvironment,
    analysisRecommendations: analysis.recommendations,
  });

  const activitySummary = isSuiAccount ? buildActivityLines(activityItems) : [];

  const brief: DailyBrief = {
    generatedAt: Date.now(),
    accountId,
    accountName,
    suiEnvironment,
    isSuiAccount,
    networkLabel,
    marketSummary,
    portfolioSummary,
    yieldSummary,
    riskAlerts,
    recommendations,
    opportunities,
    activitySummary,
    homeSummaryLines: [],
    riskProfile: chainBundle.riskProfile,
    meta: {
      devnetNoPrices,
      pricedTokenCount,
      totalTokenRows: balances.length,
    },
  };

  brief.homeSummaryLines = buildHomeLines(brief);
  return brief;
}

export function buildNonSuiDailyBriefPlaceholder(input: {
  accountId: string;
  accountName: string;
  suiEnvironment: SuiChainEnvironment;
  networkLabel: string;
  riskProfile: YieldRiskProfile;
}): DailyBrief {
  return {
    generatedAt: Date.now(),
    accountId: input.accountId,
    accountName: input.accountName,
    suiEnvironment: input.suiEnvironment,
    isSuiAccount: false,
    networkLabel: input.networkLabel,
    marketSummary: {
      trend: "unknown",
      portfolioDayChangePct: null,
      marketSentiment:
        "Switch to a Sui account to unlock priced holdings, Navi snapshots, and activity-aware lines.",
      heldMovers: [],
    },
    portfolioSummary: {
      totalValueUsd: null,
      totalValueLabel: "—",
      biggestPositionSymbol: null,
      biggestPositionPct: null,
      bestPerformerSymbol: null,
      bestPerformerPct: null,
      worstPerformerSymbol: null,
      worstPerformerPct: null,
      stableAllocationPct: null,
      diversificationScore: 0,
      idleBalances: [],
    },
    yieldSummary: {
      activePositions: [],
      availableOpportunities: [],
      highestApySymbol: null,
      highestApyPct: null,
      estimatedAnnualYieldUsd: null,
    },
    riskAlerts: [],
    recommendations: [
      `Stored yield risk profile: ${input.riskProfile} — it will shape copy once a Sui account is active.`,
    ],
    opportunities: ["Select a Sui account to compare idle balances with live Navi supply APYs."],
    activitySummary: [],
    homeSummaryLines: [
      "Daily Brief is built from your Sui balances, Navi positions, and recent activity.",
      "Switch to a Sui account on Home for a portfolio-aware summary.",
    ],
    riskProfile: input.riskProfile,
    meta: { devnetNoPrices: false, pricedTokenCount: 0, totalTokenRows: 0 },
  };
}
