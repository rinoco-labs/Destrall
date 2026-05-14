import type { SuiChainEnvironment } from "../config/chains/sui";
import type { TokenBalanceView } from "../types/blockchain";
import type { YieldRiskProfile } from "../packages/core/yield/navi/navi-risk.heuristics";
import {
  buildPortfolioRecommendationDigest,
  type NaviPositionSnapshot,
  type StablePoolApyHint,
} from "./recommendationEngine";

export type PortfolioAnalysis = {
  totalPortfolioUsd?: string;
  stableExposurePct?: number;
  concentrationWarnings: string[];
  idleAssets: string[];
  diversificationScore: number;
  riskScore: number;
  risk: "low" | "medium" | "high";
  recommendations: string[];
};

function riskBand(score: number): "low" | "medium" | "high" {
  if (score < 38) return "low";
  if (score < 62) return "medium";
  return "high";
}

export function analyzePortfolio(input: {
  balances: TokenBalanceView[];
  riskProfile: YieldRiskProfile;
  suiEnvironment: SuiChainEnvironment;
  naviPositions?: NaviPositionSnapshot[];
  stablePoolApyHints?: StablePoolApyHint[];
}): PortfolioAnalysis {
  const digest = buildPortfolioRecommendationDigest(input);
  const priced = input.balances
    .map((b) => ({ b, usd: parseUsd(b.usdValue) }))
    .filter((x): x is { b: TokenBalanceView; usd: number } => x.usd != null);
  let totalPortfolioUsd: string | undefined;
  if (priced.length) {
    const sum = priced.reduce((s, x) => s + x.usd, 0);
    totalPortfolioUsd = sum.toFixed(2);
  }
  const stableLine = digest.digestLines.find((l) => l.startsWith("Approx. stablecoin exposure"));
  const stableExposurePct = stableLine
    ? Number.parseFloat(stableLine.split(":")[1]?.replace("%", "").trim() ?? "")
    : undefined;

  const concentrationWarnings = digest.concentrationNote ? [digest.concentrationNote] : [];
  for (const t of digest.proactiveTriggers) {
    if (t.toLowerCase().includes("concentrat")) concentrationWarnings.push(t);
  }

  const idleAssets = digest.digestLines
    .filter((l) => l.startsWith("Idle stable-type wallet balance"))
    .map((l) => l.replace(/^Idle stable-type wallet balance:\s*/i, ""));

  const recommendations = [...digest.proactiveTriggers].slice(0, 4);

  return {
    totalPortfolioUsd,
    stableExposurePct: Number.isFinite(stableExposurePct) ? stableExposurePct : undefined,
    concentrationWarnings,
    idleAssets,
    diversificationScore: digest.diversificationScore0to100,
    riskScore: digest.riskScore0to100,
    risk: riskBand(digest.riskScore0to100),
    recommendations,
  };
}

function parseUsd(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Short user-facing copy when a portfolio card is shown (no LLM). */
export function buildPortfolioCardCaption(
  analysis: PortfolioAnalysis,
  pricedAssetCount: number,
  totalSymbols: number,
): string {
  const parts: string[] = [];
  if (analysis.totalPortfolioUsd) {
    parts.push(
      `Approximate wallet value (priced tokens only): ~$${analysis.totalPortfolioUsd}. See the portfolio card for live balances.`,
    );
  } else {
    parts.push(
      `Here is your on-chain token breakdown (${totalSymbols} assets). USD totals may be incomplete where prices are missing — see the card.`,
    );
  }
  if (pricedAssetCount > 0 && analysis.recommendations[0]) {
    parts.push(analysis.recommendations[0]);
  } else if (analysis.concentrationWarnings[0]) {
    parts.push(analysis.concentrationWarnings[0]);
  }
  return parts.join(" ").slice(0, 600);
}
