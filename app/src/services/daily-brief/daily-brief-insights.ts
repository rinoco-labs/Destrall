import type { TokenBalanceView } from "../../types/blockchain";
import type { SuiChainEnvironment } from "../../config/chains/sui";
import type { YieldRiskProfile } from "../../packages/core/yield/navi/navi-risk.heuristics";
import {
  isLikelyStablecoin,
  recommendationPreamble,
} from "../../packages/core/yield/navi/navi-risk.heuristics";
import { analyzePortfolio } from "../../assistant/portfolio-analysis.service";
import type { NaviPoolRow, NaviPositionView } from "../../packages/core/yield/navi/navi.types";

function parseUsd(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function buildPersonalizedRecommendations(input: {
  balances: TokenBalanceView[];
  pools: NaviPoolRow[];
  positions: NaviPositionView[];
  riskProfile: YieldRiskProfile;
  suiEnvironment: SuiChainEnvironment;
  analysisRecommendations: string[];
}): string[] {
  const { balances, pools, positions, riskProfile, suiEnvironment, analysisRecommendations } = input;
  const lines: string[] = [];

  lines.push(recommendationPreamble(riskProfile));

  for (const r of analysisRecommendations.slice(0, 3)) {
    lines.push(r);
  }

  if (suiEnvironment === "mainnet" && pools.length > 0) {
    const naviSyms = new Set(positions.map((p) => p.assetSymbol.toUpperCase()));
    const priced = balances
      .map((b) => ({ b, usd: parseUsd(b.usdValue) }))
      .filter((x): x is { b: TokenBalanceView; usd: number } => x.usd != null);

    if (priced.length > 0) {
      const total = priced.reduce((s, x) => s + x.usd, 0);
      const top = [...priced].sort((a, b) => b.usd - a.usd)[0];
      const topShare = top ? top.usd / total : 0;
      const topPool = pools.find((p) => p.symbol.toUpperCase() === top?.b.symbol.toUpperCase());

      if (riskProfile === "aggressive" || riskProfile === "max_yield") {
        if (top && topPool && topPool.supplyApy > 0 && !naviSyms.has(top.b.symbol.toUpperCase())) {
          lines.push(
            `Your largest priced line (${top.b.symbol}) is not in a Navi supply slot — if you want more yield exposure, review a deposit proposal and protocol risk first.`,
          );
        }
      }

      if ((riskProfile === "conservative" || riskProfile === "balanced") && top && topShare > 0.5) {
        const bestStable = pools
          .filter((p) => isLikelyStablecoin(p.symbol))
          .sort((a, b) => b.supplyApy - a.supplyApy)[0];
        if (bestStable) {
          lines.push(
            `With meaningful weight in ${top.b.symbol}, a partial stable allocation (for example Navi ${bestStable.symbol} ~${bestStable.supplyApy.toFixed(2)}% snapshot APY) can reduce day-to-day volatility versus holding everything in one volatile line.`,
          );
        }
      }
    }
  }

  return [...new Set(lines)].slice(0, 8);
}

export function extractPortfolioAnalysisScores(
  balances: TokenBalanceView[],
  riskProfile: YieldRiskProfile,
  suiEnvironment: SuiChainEnvironment,
  positions: NaviPositionView[],
  pools: NaviPoolRow[],
) {
  const stablePoolApyHints = pools
    .filter((p) => isLikelyStablecoin(p.symbol))
    .sort((a, b) => b.supplyApy - a.supplyApy)
    .slice(0, 4)
    .map((p) => ({ symbol: p.symbol, apyPct: p.supplyApy }));

  const naviPositions = positions.map((v) => ({
    symbol: v.assetSymbol,
    suppliedFormatted: v.suppliedFormatted,
    apy: v.apy,
  }));

  return analyzePortfolio({
    balances,
    riskProfile,
    suiEnvironment,
    naviPositions,
    stablePoolApyHints,
  });
}
