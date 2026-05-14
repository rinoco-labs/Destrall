import type { NaviPoolRow } from "../packages/core/yield/navi/navi.types";
import type { YieldRiskProfile } from "../packages/core/yield/navi/navi-risk.service";
import { isLikelyStablecoin, sortPoolsForRiskProfile } from "../packages/core/yield/navi/navi-risk.service";

export type YieldRecommendation = {
  bestPools: NaviPoolRow[];
  highestAPY: NaviPoolRow | null;
  recommendedPools: NaviPoolRow[];
  lowRiskPools: NaviPoolRow[];
  highRiskPools: NaviPoolRow[];
};

export function buildYieldRecommendation(
  pools: NaviPoolRow[],
  riskProfile: YieldRiskProfile,
  topN = 8,
): YieldRecommendation {
  const copy = [...pools];
  const recommendedPools = sortPoolsForRiskProfile(copy, riskProfile, "apy").slice(0, topN);
  const byApy = [...pools].sort((a, b) => b.supplyApy - a.supplyApy);
  const highestAPY = byApy[0] ?? null;
  const lowRiskPools = pools
    .filter((p) => p.risk === "low" || isLikelyStablecoin(p.symbol))
    .sort((a, b) => b.supplyApy - a.supplyApy)
    .slice(0, topN);
  const highRiskPools = pools
    .filter((p) => p.risk === "high")
    .sort((a, b) => b.supplyApy - a.supplyApy)
    .slice(0, topN);
  return {
    bestPools: recommendedPools,
    highestAPY,
    recommendedPools,
    lowRiskPools,
    highRiskPools,
  };
}

/** Concise caption for pool cards / maximize-yield turns (deterministic, no LLM). */
export function buildYieldOpportunityCaption(
  rec: YieldRecommendation,
  riskProfile: YieldRiskProfile,
  networkLabel: string,
): string {
  const top = rec.recommendedPools.slice(0, 3);
  const lines = top.map((p) => `${p.symbol}: ${p.supplyApy.toFixed(2)}% supply APY`).join("; ");
  const warn =
    riskProfile === "conservative"
      ? "Stable / low-volatility pools are emphasized for your profile."
      : riskProfile === "max_yield" || riskProfile === "aggressive"
        ? "Higher APY usually means more price and protocol risk — rates move."
        : "Balancing headline APY with the pool risk labels shown on the card.";
  return `Live Navi pools on ${networkLabel}. Standout supply APYs (sorted for your ${riskProfile} profile): ${lines}. ${warn}`.slice(
    0,
    700,
  );
}
