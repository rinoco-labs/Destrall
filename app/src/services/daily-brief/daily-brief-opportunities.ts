import type { TokenBalanceView } from "../../types/blockchain";
import type { SuiChainEnvironment } from "../../config/chains/sui";
import { isLikelyStablecoin, sortPoolsForRiskProfile } from "../../packages/core/yield/navi/navi-risk.heuristics";
import type { YieldRiskProfile } from "../../packages/core/yield/navi/navi-risk.heuristics";
import type { NaviPoolRow, NaviPositionView } from "../../packages/core/yield/navi/navi.types";

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

export function buildOpportunityLines(input: {
  balances: TokenBalanceView[];
  pools: NaviPoolRow[];
  positions: NaviPositionView[];
  riskProfile: YieldRiskProfile;
  suiEnvironment: SuiChainEnvironment;
}): string[] {
  const { balances, pools, positions, riskProfile, suiEnvironment } = input;
  const out: string[] = [];
  if (suiEnvironment !== "mainnet" || pools.length === 0) {
    if (suiEnvironment !== "mainnet") {
      out.push("Navi pool snapshots load on Sui mainnet — switch networks to compare live supply APYs.");
    }
    return out.slice(0, 6);
  }

  const naviSyms = new Set(positions.map((p) => p.assetSymbol.toUpperCase()));
  const poolBySym = new Map(pools.map((p) => [p.symbol.toUpperCase(), p]));

  for (const b of balances) {
    if (!positiveRaw(b.balanceRaw)) continue;
    if (!isLikelyStablecoin(b.symbol)) continue;
    const sym = b.symbol.toUpperCase();
    if (naviSyms.has(sym)) continue;
    const pool = poolBySym.get(sym);
    if (pool && pool.supplyApy > 0) {
      out.push(`Idle ${b.symbol} (~${b.balanceFormatted}): Navi supply APY snapshot ~${pool.supplyApy.toFixed(2)}% if you choose to deploy it.`);
    } else {
      out.push(`Idle ${b.symbol} (~${b.balanceFormatted}) is not reflected in Navi positions — optional yield review on your terms.`);
    }
  }

  const sortedVolatile = sortPoolsForRiskProfile(
    pools.filter((p) => !isLikelyStablecoin(p.symbol)),
    riskProfile,
    "apy",
  );
  const topV = sortedVolatile[0];
  if (topV && topV.supplyApy > 0) {
    out.push(`Among volatile pools sorted for your ${riskProfile} profile, ${topV.symbol} shows ~${topV.supplyApy.toFixed(2)}% supply APY (rates move; check the live pool card).`);
  }

  const stables = pools.filter((p) => isLikelyStablecoin(p.symbol)).sort((a, b) => b.supplyApy - a.supplyApy);
  const topS = stables[0];
  if (topS) {
    out.push(`Highest stablecoin supply APY in the current Navi snapshot: ${topS.symbol} ~${topS.supplyApy.toFixed(2)}%.`);
  }

  const priced = balances
    .map((b) => ({ b, usd: parseUsd(b.usdValue) }))
    .filter((x): x is { b: TokenBalanceView; usd: number } => x.usd != null);
  if (priced.length > 1) {
    const total = priced.reduce((s, x) => s + x.usd, 0);
    const top = [...priced].sort((a, b) => b.usd - a.usd)[0];
    if (top && top.usd / total >= 0.55) {
      out.push(`${top.b.symbol} dominates the priced wallet — consider whether part of that exposure should sit in stables or vetted yield instead.`);
    }
  }

  const suiBal = balances.find((b) => b.coinType.endsWith("::sui::SUI"));
  if (suiBal && positiveRaw(suiBal.balanceRaw) && !naviSyms.has("SUI")) {
    const pool = poolBySym.get("SUI");
    if (pool && pool.supplyApy > 0 && parseUsd(suiBal.usdValue) != null && (parseUsd(suiBal.usdValue) ?? 0) > 15) {
      out.push(`A meaningful SUI balance is in the wallet (not Navi-supplied) — Navi snapshot supply APY ~${pool.supplyApy.toFixed(2)}% if yield fits your risk tolerance.`);
    }
  }

  return [...new Set(out)].slice(0, 7);
}
