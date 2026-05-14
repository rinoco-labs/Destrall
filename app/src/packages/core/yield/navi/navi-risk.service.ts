import { getDatabase } from "../../../../main/persistence/database";
import type { NaviPoolRow, NaviRiskLabel } from "./navi.types";

const YIELD_RISK_KEY = "assistant_yield_risk_tolerance";

const STABLE_SYMBOLS = new Set([
  "USDC",
  "USDT",
  "AUSD",
  "FDUSD",
  "USDY",
  "nUSDC",
  "wUSDC",
  "suiUSDT",
  "BUCK",
]);

export type YieldRiskProfile = "conservative" | "balanced" | "aggressive" | "max_yield";

export function readStoredYieldRiskProfile(): YieldRiskProfile {
  try {
    const row = getDatabase()
      .prepare(`SELECT value FROM app_settings WHERE key = ?`)
      .get(YIELD_RISK_KEY) as { value: string } | undefined;
    const v = row?.value?.trim();
    if (v === "conservative" || v === "balanced" || v === "aggressive" || v === "max_yield") return v;
  } catch {
    /* ignore */
  }
  return "balanced";
}

export function riskLabelForSymbol(symbol: string): NaviRiskLabel {
  const s = symbol.toUpperCase();
  if (STABLE_SYMBOLS.has(s) || s.endsWith("USD") || s.includes("USDC") || s.includes("USDT")) {
    return "low";
  }
  if (["SUI", "STSUI", "HASUI", "VSUI", "WAL", "DEEP"].includes(s)) {
    return "medium";
  }
  return "high";
}

/** True when the symbol is treated as low-volatility / stable-ish for portfolio and pool-risk heuristics. */
export function isLikelyStablecoin(symbol: string): boolean {
  return riskLabelForSymbol(symbol) === "low";
}

export function sortPoolsForRiskProfile(
  pools: NaviPoolRow[],
  profile: YieldRiskProfile,
  sortBy?: "apy" | "tvl" | "risk",
): NaviPoolRow[] {
  const copy = [...pools];
  const riskOrder = (r: NaviRiskLabel) => (r === "low" ? 0 : r === "medium" ? 1 : 2);

  if (sortBy === "tvl") {
    copy.sort((a, b) => {
      const ta = parseFloat(a.totalSupplyRaw) * (a.priceUsd ?? 0);
      const tb = parseFloat(b.totalSupplyRaw) * (b.priceUsd ?? 0);
      return tb - ta;
    });
    return copy;
  }

  if (sortBy === "risk") {
    copy.sort((a, b) => riskOrder(a.risk) - riskOrder(b.risk) || b.supplyApy - a.supplyApy);
    return copy;
  }

  if (profile === "conservative") {
    copy.sort((a, b) => riskOrder(a.risk) - riskOrder(b.risk) || b.supplyApy - a.supplyApy);
    return copy;
  }
  if (profile === "aggressive" || profile === "max_yield") {
    copy.sort((a, b) => b.supplyApy - a.supplyApy || riskOrder(b.risk) - riskOrder(a.risk));
    return copy;
  }

  copy.sort((a, b) => {
    const score = (p: NaviPoolRow) => p.supplyApy / (1 + riskOrder(p.risk));
    return score(b) - score(a);
  });
  return copy;
}

export function recommendationPreamble(profile: YieldRiskProfile): string {
  if (profile === "conservative") {
    return "Preferring lower-volatility assets (for example stablecoins) over raw APY.";
  }
  if (profile === "aggressive") {
    return "Higher APY pools may involve more volatile assets; prices can move against you.";
  }
  if (profile === "max_yield") {
    return "Prioritizing headline APY; expect more protocol, liquidity, and volatility risk—rates and token prices change.";
  }
  return "Balancing headline APY with asset liquidity and volatility.";
}
