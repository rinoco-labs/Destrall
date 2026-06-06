import type { NaviPoolRow } from "../../packages/core/yield/navi/navi-pools.service";
import { normalizeSuiCoinType } from "../../main/services/chains/sui/sui-coin-type-normalize";
import { findTokenAliasGroup, normalizeTokenInput, tokenLabelsMatch } from "./tokenAliases";

export type NaviPoolCandidate = {
  symbol: string;
  coinType: string;
  assetId: number;
  matchScore: number;
  matchReason: string;
};

export type ResolveNaviPoolResult =
  | { kind: "resolved"; pool: NaviPoolRow }
  | { kind: "ambiguous"; userInput: string; candidates: NaviPoolCandidate[] }
  | { kind: "not_found"; userInput: string; message: string };

function scorePool(input: string, pool: NaviPoolRow): { score: number; reason: string } | null {
  const raw = input.trim();
  if (!raw) return null;
  const symUpper = pool.symbol.toUpperCase();
  const inputUpper = raw.toUpperCase();

  if (symUpper === inputUpper) return { score: 900, reason: "exact_symbol" };
  if (tokenLabelsMatch(raw, pool.symbol)) return { score: 850, reason: "alias_group" };

  const group = findTokenAliasGroup(raw);
  if (group && tokenLabelsMatch(pool.symbol, group.canonicalSymbol)) {
    return { score: 800, reason: "alias_canonical" };
  }

  if (symUpper.includes(inputUpper) || inputUpper.includes(symUpper)) {
    return { score: 500, reason: "partial_symbol" };
  }

  const normCoin = normalizeSuiCoinType(pool.coinType);
  if (raw.includes("::") && normCoin === normalizeSuiCoinType(raw)) {
    return { score: 1000, reason: "exact_coin_type" };
  }

  return null;
}

/** Resolve user asset text to a Navi pool row. */
export function resolveNaviPoolByAsset(
  pools: NaviPoolRow[],
  asset: string,
): ResolveNaviPoolResult {
  const userInput = asset.trim();
  if (!userInput) {
    return { kind: "not_found", userInput, message: "Specify an asset for the Navi pool." };
  }

  const scored: NaviPoolCandidate[] = [];
  for (const p of pools) {
    const hit = scorePool(userInput, p);
    if (!hit || hit.score < 500) continue;
    scored.push({
      symbol: p.symbol,
      coinType: p.coinType,
      assetId: p.assetId,
      matchScore: hit.score,
      matchReason: hit.reason,
    });
  }

  scored.sort((a, b) => b.matchScore - a.matchScore);
  if (scored.length === 0) {
    const syms = pools.slice(0, 12).map((p) => p.symbol).join(", ");
    return {
      kind: "not_found",
      userInput,
      message: `Could not find a Navi pool for "${userInput}". Available pools include: ${syms}${pools.length > 12 ? ", …" : ""}.`,
    };
  }

  const top = scored[0];
  const second = scored[1];
  if (
    second &&
    top.matchScore === second.matchScore &&
    normalizeSuiCoinType(top.coinType) !== normalizeSuiCoinType(second.coinType)
  ) {
    return { kind: "ambiguous", userInput, candidates: scored };
  }

  const pool = pools.find((p) => p.assetId === top.assetId);
  if (!pool) {
    return { kind: "not_found", userInput, message: `Navi pool for "${userInput}" is no longer available.` };
  }

  return { kind: "resolved", pool };
}

/** Match Navi withdraw positions by asset input (fuzzy / alias). */
export function resolveNaviPositionAsset<T extends { assetSymbol: string; coinType?: string; assetId?: number }>(
  positions: T[],
  asset: string,
): { kind: "resolved"; position: T } | { kind: "ambiguous"; positions: T[] } | { kind: "not_found" } {
  const userInput = asset.trim();
  const matches = positions.filter((p) => {
    if (tokenLabelsMatch(userInput, p.assetSymbol)) return true;
    if (p.coinType && userInput.includes("::")) {
      return normalizeSuiCoinType(p.coinType) === normalizeSuiCoinType(userInput);
    }
    const norm = normalizeTokenInput(userInput);
    return normalizeTokenInput(p.assetSymbol).includes(norm) || norm.includes(normalizeTokenInput(p.assetSymbol));
  });

  if (matches.length === 1) return { kind: "resolved", position: matches[0] };
  if (matches.length > 1) return { kind: "ambiguous", positions: matches };
  return { kind: "not_found" };
}
