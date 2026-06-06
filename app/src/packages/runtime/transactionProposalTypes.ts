import type { SuiChainEnvironment } from "../../config/chains/sui";

/**
 * Persisted on send proposals so approval can re-validate account, network,
 * and inputs before signing (never stores secrets).
 */
export type SendProposalSnapshot = {
  accountId: string;
  suiEnvironment: SuiChainEnvironment;
  senderAddress: string;
  recipientAddress: string;
  coinType: string;
  /** Display string passed to prepareTransfer (human-readable amount). */
  amountDisplay: string;
  /** Token decimals from wallet balance row at prepare time. */
  decimals: number;
  /** Raw balance from wallet at prepare time (for address-balance aware validation). */
  walletBalanceRaw: string;
  /** Resolved token symbol at prepare time. */
  symbol: string;
};
