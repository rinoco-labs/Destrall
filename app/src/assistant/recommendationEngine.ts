import type { SuiChainEnvironment } from "../config/chains/sui";
import type { TokenBalanceView } from "../types/blockchain";
import type { YieldRiskProfile } from "../packages/core/yield/navi/navi-risk.heuristics";
import { isLikelyStablecoin } from "../packages/core/yield/navi/navi-risk.heuristics";

export type NaviPositionSnapshot = {
  symbol: string;
  suppliedFormatted: string;
  apy?: number;
};

export type StablePoolApyHint = {
  symbol: string;
  apyPct: number;
};

export type PortfolioRecommendationDigest = {
  riskScore0to100: number;
  diversificationScore0to100: number;
  concentrationNote?: string;
  /** Lines appended to assistant context (deterministic, non-authoritative heuristics). */
  digestLines: string[];
  /** Short bullets the model may surface when relevant (avoid spamming every turn). */
  proactiveTriggers: string[];
};

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

/**
 * Deterministic portfolio heuristics for assistant context (not investment advice).
 */
export function buildPortfolioRecommendationDigest(input: {
  balances: TokenBalanceView[];
  riskProfile: YieldRiskProfile;
  suiEnvironment: SuiChainEnvironment;
  naviPositions?: NaviPositionSnapshot[];
  stablePoolApyHints?: StablePoolApyHint[];
}): PortfolioRecommendationDigest {
  const { balances, riskProfile, suiEnvironment, naviPositions = [], stablePoolApyHints = [] } = input;
  const digestLines: string[] = [];
  const proactiveTriggers: string[] = [];
  let riskScore0to100 = 32;
  let diversificationScore0to100 = 52;
  let concentrationNote: string | undefined;

  const naviSymbols = new Set(naviPositions.map((p) => p.symbol.toUpperCase()));

  const priced = balances
    .map((b) => ({ b, usd: parseUsd(b.usdValue) }))
    .filter((x): x is { b: TokenBalanceView; usd: number } => x.usd != null);

  if (priced.length === 0) {
    digestLines.push(
      "Allocation heuristics: USD marks missing for priced totals — avoid stating portfolio percentages; describe tokens qualitatively only.",
    );
    if (balances.filter((b) => positiveRaw(b.balanceRaw)).length >= 6) {
      proactiveTriggers.push(
        "Many token lines detected — consider gas and DEX liquidity when suggesting multiple small swaps.",
      );
    }
  } else {
    const total = priced.reduce((s, x) => s + x.usd, 0);
    const weights = priced.map(({ b, usd }) => ({ b, w: usd / total }));
    weights.sort((a, b) => b.w - a.w);
    const top = weights[0];
    const topShare = top ? top.w : 0;

    const stableUsd = priced.filter(({ b }) => isLikelyStablecoin(b.symbol)).reduce((s, x) => s + x.usd, 0);
    const stableRatio = total > 0 ? stableUsd / total : 0;

    digestLines.push(
      `Approx. stablecoin exposure (USD-priced subset): ${(stableRatio * 100).toFixed(1)}%.`,
    );
    digestLines.push(
      `Largest single-token weight (USD-priced subset): ${top?.b.symbol ?? "—"} ~${(topShare * 100).toFixed(1)}%.`,
    );

    if (topShare >= 0.75 && top) {
      concentrationNote = `Heavy concentration: ~${(topShare * 100).toFixed(0)}% in ${top.b.symbol} (priced subset).`;
      proactiveTriggers.push(
        `Portfolio is highly concentrated in ${top.b.symbol}. Consider diversification or allocating part to stable assets or vetted yield strategies (via in-app proposals only).`,
      );
      riskScore0to100 = Math.min(100, Math.round(52 + topShare * 38));
    } else if (topShare >= 0.55 && top) {
      concentrationNote = `Moderate concentration: ~${(topShare * 100).toFixed(0)}% in ${top.b.symbol} (priced subset).`;
      riskScore0to100 = Math.min(100, Math.round(42 + topShare * 32));
    } else {
      riskScore0to100 = Math.round(24 + topShare * 34 + (1 - stableRatio) * 18);
    }

    const hhi = weights.reduce((s, x) => s + x.w * x.w, 0);
    diversificationScore0to100 = Math.round(Math.max(0, Math.min(100, (1 - hhi) * 130)));

    if (stableRatio < 0.12 && riskProfile === "conservative") {
      proactiveTriggers.push(
        "Stablecoin weight is very low for a conservative profile — consider whether capital preservation warrants more stable exposure (via user-approved actions only).",
      );
    }
  }

  const idleStableLines = new Set<string>();
  for (const b of balances) {
    if (!isLikelyStablecoin(b.symbol)) continue;
    if (!positiveRaw(b.balanceRaw)) continue;
    const sym = b.symbol.toUpperCase();
    if (naviSymbols.has(sym)) continue;
    const hint = stablePoolApyHints.find((h) => h.symbol.toUpperCase() === sym);
    const apyFrag = hint
      ? ` Last Navi supply APY snapshot for ${sym}: ~${hint.apyPct.toFixed(2)}% (verify on live pool card before acting).`
      : "";
    idleStableLines.add(
      `Idle stable-type wallet balance: ${b.symbol} ${b.balanceFormatted}.${apyFrag}`,
    );
    if (suiEnvironment === "mainnet" && proactiveTriggers.length < 5) {
      proactiveTriggers.push(
        `Idle ${b.symbol} is not listed in Navi positions — optional next step: review a Navi deposit proposal if yield fits the user’s risk tolerance.${hint ? ` Recent snapshot APY ~${hint.apyPct.toFixed(2)}%.` : ""}`,
      );
    }
  }
  for (const line of idleStableLines) digestLines.push(line);

  digestLines.push(
    `Risk profile (assistant_yield_risk_tolerance): ${riskProfile} — align suggestions with this setting.`,
  );
  digestLines.push(`Heuristic risk score (0–100, higher ≈ more concentration/volatility exposure): ${riskScore0to100}.`);
  digestLines.push(
    `Heuristic diversification score (0–100, higher ≈ more spread across the priced subset): ${diversificationScore0to100}.`,
  );

  if (naviPositions.length) {
    digestLines.push("Navi yield positions (snapshot):");
    for (const p of naviPositions.slice(0, 10)) {
      digestLines.push(
        `- ${p.symbol}: supplied ${p.suppliedFormatted}${p.apy != null ? `, supply APY ~${p.apy.toFixed(2)}%` : ""}`,
      );
    }
  } else if (suiEnvironment === "mainnet") {
    digestLines.push("Navi yield positions (snapshot): none returned for configured pools.");
  }

  return {
    riskScore0to100,
    diversificationScore0to100,
    concentrationNote,
    digestLines,
    proactiveTriggers: proactiveTriggers.slice(0, 5),
  };
}

/** One-line note for portfolio summary cards (priced subset only). */
export function portfolioCardConcentrationNote(balances: TokenBalanceView[]): string | undefined {
  return buildPortfolioRecommendationDigest({
    balances,
    riskProfile: "balanced",
    suiEnvironment: "mainnet",
  }).concentrationNote;
}
