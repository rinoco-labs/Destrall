import type { TokenBalanceView } from "../../types/blockchain";
import type { YieldRiskProfile } from "../../packages/core/yield/navi/navi-risk.heuristics";
import { isLikelyStablecoin, riskLabelForSymbol } from "../../packages/core/yield/navi/navi-risk.heuristics";
import type { NaviPositionView } from "../../packages/core/yield/navi/navi.types";

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

export function buildRiskAlerts(input: {
  balances: TokenBalanceView[];
  positions: NaviPositionView[];
  riskProfile: YieldRiskProfile;
}): string[] {
  const alerts: string[] = [];
  const { balances, positions, riskProfile } = input;

  const priced = balances
    .map((b) => ({ b, usd: parseUsd(b.usdValue) }))
    .filter((x): x is { b: TokenBalanceView; usd: number } => x.usd != null);

  if (priced.length > 0) {
    const total = priced.reduce((s, x) => s + x.usd, 0);
    const weights = priced.map(({ b, usd }) => ({ b, w: usd / total }));
    weights.sort((a, b) => b.w - a.w);
    const top = weights[0];
    if (top && top.w >= 0.58) {
      alerts.push(`${top.b.symbol} represents about ${(top.w * 100).toFixed(0)}% of your priced wallet — concentration is elevated.`);
    } else if (top && top.w >= 0.45) {
      alerts.push(`${top.b.symbol} is roughly ${(top.w * 100).toFixed(0)}% of priced holdings — worth watching concentration.`);
    }

    const stableUsd = priced.filter(({ b }) => isLikelyStablecoin(b.symbol)).reduce((s, x) => s + x.usd, 0);
    const stableRatio = total > 0 ? stableUsd / total : 0;
    if (stableRatio < 0.1 && riskProfile === "conservative") {
      alerts.push("Stable allocation is under about 10% of priced holdings while your yield risk profile is conservative.");
    } else if (stableRatio < 0.08) {
      alerts.push(`Stablecoins are a small slice of priced holdings (~${(stableRatio * 100).toFixed(0)}%).`);
    }
  }

  const volSymbols = balances
    .filter((b) => b.usdPriceChange24hPct != null && Math.abs(b.usdPriceChange24hPct) >= 8)
    .filter((b) => riskLabelForSymbol(b.symbol) !== "low")
    .slice(0, 2);
  for (const b of volSymbols) {
    alerts.push(`${b.symbol} showed a larger 24h price swing (~${(b.usdPriceChange24hPct ?? 0).toFixed(1)}%) — volatility is elevated for that line.`);
  }

  const naviSyms = new Set(positions.map((p) => p.assetSymbol.toUpperCase()));
  for (const b of balances) {
    if (!positiveRaw(b.balanceRaw)) continue;
    const sym = b.symbol.toUpperCase();
    if (naviSyms.has(sym)) continue;
    if (riskLabelForSymbol(b.symbol) === "high" && parseUsd(b.usdValue) != null && (parseUsd(b.usdValue) ?? 0) > 25) {
      alerts.push(`You hold a non-trivial ${b.symbol} wallet balance that is not in a Navi supply position — price risk sits in the wallet.`);
      break;
    }
  }

  return alerts.slice(0, 5);
}
