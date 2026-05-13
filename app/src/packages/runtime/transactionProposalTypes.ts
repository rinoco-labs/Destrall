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
};
