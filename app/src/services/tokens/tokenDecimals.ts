import type { TokenBalanceView } from "../../types/blockchain.ts";
import {
  decimalsResolutionFailedMessage,
  getTokenDecimalsFromBalance,
  TokenAmountError,
} from "../../shared/tokens/amounts.ts";
import type { SuiTokenMetadataService } from "../../main/services/chains/sui/sui-token-metadata.service.ts";
import { getSwappableTokenByAddress } from "./swappableTokenRegistry.ts";

/** Read decimals from a wallet balance row (preferred source for assistant flows). */
export function resolveTokenDecimalsFromBalance(
  balance: Pick<TokenBalanceView, "decimals" | "symbol">,
): number {
  return getTokenDecimalsFromBalance(balance);
}

/** Registry decimals for a coin type, or null when not configured. */
export function resolveTokenDecimalsFromRegistry(coinType: string): number | null {
  const entry = getSwappableTokenByAddress("sui", coinType);
  if (entry && typeof entry.decimals === "number" && Number.isFinite(entry.decimals)) {
    return entry.decimals;
  }
  return null;
}

/**
 * Resolve token decimals with explicit priority:
 * 1. Wallet balance row (if provided)
 * 2. Trusted token registry
 * 3. On-chain metadata lookup (if service provided)
 * Throws when decimals cannot be resolved — never guesses.
 */
export async function resolveTokenDecimalsForCoinType(
  coinType: string,
  options?: {
    balance?: Pick<TokenBalanceView, "decimals" | "symbol">;
    metadataService?: SuiTokenMetadataService;
  },
): Promise<number> {
  if (options?.balance) {
    try {
      return getTokenDecimalsFromBalance(options.balance);
    } catch {
      // fall through
    }
  }

  const fromRegistry = resolveTokenDecimalsFromRegistry(coinType);
  if (fromRegistry !== null) return fromRegistry;

  if (options?.metadataService) {
    const meta = await options.metadataService.getCoinMetadata(coinType);
    return meta.decimals;
  }

  throw new TokenAmountError(decimalsResolutionFailedMessage(), "decimals_unresolved");
}
