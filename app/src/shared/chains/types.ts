import type {
  ChainActivityPage,
  NetworkUiSnapshot,
  TokenBalanceView,
  TransferExecuteResult,
  TransferPrepareResult,
} from "../types/blockchain";
import type { ChainId } from "../wallet/types";

/** Chain-facing read model — implemented per chain (Sui today). */
export type WalletChainReadService = {
  readonly chain: ChainId;
  getBalances(params: { address: string }): Promise<TokenBalanceView[]>;
  getActivity(params: {
    address: string;
    cursor?: string | null;
    limit?: number;
  }): Promise<ChainActivityPage>;
};

export type WalletChainTransferService = {
  readonly chain: ChainId;
  prepareTransfer(params: {
    senderAddress: string;
    recipient: string;
    coinType: string;
    amountRaw: string;
  }): Promise<TransferPrepareResult>;
  confirmTransfer(params: { transferRequestId: string }): Promise<TransferExecuteResult>;
};

export type NetworkSettingsReader = {
  getSnapshot(): NetworkUiSnapshot;
};

export type ChainServicesBundle = {
  network: NetworkSettingsReader;
  read: WalletChainReadService;
  transfer: WalletChainTransferService;
};
