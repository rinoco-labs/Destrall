import { normalizeStructTag } from "@mysten/sui/utils";
import { SUI_COIN_TYPE } from "../../../../config/chains/sui";

/**
 * Canonical Sui fungible / struct type string (padded 0x address), matching RPC / router conventions.
 * Aftermath’s supported-coins list uses this form; wallet balances may use short addresses (e.g. 0x2::sui::SUI).
 */
export function normalizeSuiCoinType(coinType: string): string {
  const t = coinType.trim();
  if (!t.includes("::")) return t;
  try {
    return normalizeStructTag(t);
  } catch {
    return t;
  }
}

let memoNormalizedSui: string | null = null;

export function getNormalizedSuiCoinType(): string {
  if (memoNormalizedSui == null) {
    memoNormalizedSui = normalizeSuiCoinType(SUI_COIN_TYPE);
  }
  return memoNormalizedSui;
}

export function isNormalizedSuiNativeCoin(coinType: string): boolean {
  try {
    return normalizeSuiCoinType(coinType) === getNormalizedSuiCoinType();
  } catch {
    return coinType.trim() === SUI_COIN_TYPE;
  }
}
