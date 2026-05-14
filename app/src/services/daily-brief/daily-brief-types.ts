import type { SuiChainEnvironment } from "../../config/chains/sui";
import type { ChainActivityItem, TokenBalanceView } from "../../types/blockchain";
import type { YieldRiskProfile } from "../../packages/core/yield/navi/navi-risk.heuristics";
import type { NaviPoolRow, NaviPositionView } from "../../packages/core/yield/navi/navi.types";

export type DailyBriefMarketSummary = {
  trend: "up" | "down" | "flat" | "unknown";
  /** Weighted 24h % change across USD-priced holdings; null when quotes are missing. */
  portfolioDayChangePct: number | null;
  /** Short phrase derived only from the user's priced holdings (no generic macro news). */
  marketSentiment: string;
  /** Not available without an external feed — always omitted in v1 to avoid fabrication. */
  btcDominance?: undefined;
  /** Top absolute 24h movers among held tokens (symbol + pct). */
  heldMovers: { symbol: string; change24hPct: number }[];
};

export type DailyBriefPortfolioSummary = {
  totalValueUsd: number | null;
  totalValueLabel: string;
  biggestPositionSymbol: string | null;
  biggestPositionPct: number | null;
  bestPerformerSymbol: string | null;
  bestPerformerPct: number | null;
  worstPerformerSymbol: string | null;
  worstPerformerPct: number | null;
  stableAllocationPct: number | null;
  diversificationScore: number;
  idleBalances: { symbol: string; balanceFormatted: string; approxUsd: number | null }[];
};

export type DailyBriefYieldPositionRow = {
  symbol: string;
  suppliedFormatted: string;
  apyPct: number;
  risk: string;
  approxUsdAnnualUsd: number | null;
};

export type DailyBriefPoolOpportunity = {
  symbol: string;
  supplyApyPct: number;
  risk: string;
  reason: string;
};

export type DailyBriefYieldSummary = {
  activePositions: DailyBriefYieldPositionRow[];
  availableOpportunities: DailyBriefPoolOpportunity[];
  highestApySymbol: string | null;
  highestApyPct: number | null;
  /** Sum of estimated annual USD from positions where USD could be inferred. */
  estimatedAnnualYieldUsd: number | null;
};

export type DailyBriefActivityLine = {
  kind: "none" | "send" | "receive" | "other";
  summary: string;
  timestamp: number | null;
};

export type DailyBrief = {
  generatedAt: number;
  accountId: string;
  accountName: string;
  suiEnvironment: SuiChainEnvironment;
  isSuiAccount: boolean;
  networkLabel: string;
  marketSummary: DailyBriefMarketSummary;
  portfolioSummary: DailyBriefPortfolioSummary;
  yieldSummary: DailyBriefYieldSummary;
  riskAlerts: string[];
  recommendations: string[];
  opportunities: string[];
  activitySummary: DailyBriefActivityLine[];
  /** 3–6 short lines for Home card */
  homeSummaryLines: string[];
  riskProfile: YieldRiskProfile;
  meta: {
    devnetNoPrices: boolean;
    pricedTokenCount: number;
    totalTokenRows: number;
  };
};

export type DailyBriefBuildInput = {
  accountId: string;
  accountName: string;
  isSuiAccount: boolean;
  suiEnvironment: SuiChainEnvironment;
  networkLabel: string;
  balances: TokenBalanceView[];
  activityItems: ChainActivityItem[];
  chainBundle: {
    pools: NaviPoolRow[];
    positions: NaviPositionView[];
    riskProfile: YieldRiskProfile;
  };
};
