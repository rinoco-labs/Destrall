import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { normalizeSuiCoinType } from "./sui-coin-type-normalize";

export function coinTypeQueryVariants(coinType: string): string[] {
  const trimmed = coinType.trim();
  if (!trimmed.includes("::")) return [trimmed];
  const normalized = normalizeSuiCoinType(trimmed);
  return normalized === trimmed ? [normalized] : [trimmed, normalized];
}

export type ResolvedOnChainCoinType = {
  /** Exact coin type string as returned by the RPC (preferred for getCoins). */
  coinType: string;
  totalBalance: bigint;
};

/**
 * Resolve the on-chain coin type string that matches wallet balances.
 * getAllBalances may return a different string variant than getCoins accepts;
 * this picks the variant with the highest total for the normalized type.
 */
export async function resolveOnChainCoinType(
  client: SuiJsonRpcClient,
  owner: string,
  coinType: string,
  walletBalanceRaw?: string,
): Promise<ResolvedOnChainCoinType> {
  const want = normalizeSuiCoinType(coinType);
  let best: ResolvedOnChainCoinType | null = null;

  const all = await client.getAllBalances({ owner });
  for (const row of all) {
    if (normalizeSuiCoinType(row.coinType) !== want) continue;
    const total = BigInt(row.totalBalance);
    if (!best || total > best.totalBalance) {
      best = { coinType: row.coinType, totalBalance: total };
    }
  }

  for (const variant of coinTypeQueryVariants(coinType)) {
    try {
      const bal = await client.getBalance({ owner, coinType: variant });
      const total = BigInt(bal.totalBalance);
      if (!best || total > best.totalBalance) {
        best = { coinType: variant, totalBalance: total };
      }
    } catch {
      // try next variant
    }
  }

  if (walletBalanceRaw != null) {
    const walletTotal = BigInt(walletBalanceRaw);
    if (!best || walletTotal > best.totalBalance) {
      best = { coinType: coinType.trim(), totalBalance: walletTotal };
    }
  }

  return best ?? { coinType: want, totalBalance: 0n };
}
