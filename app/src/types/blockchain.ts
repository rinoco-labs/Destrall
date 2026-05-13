import type { ChainId } from "../shared/wallet/types";
import type { SuiChainEnvironment } from "../config/chains/sui";

/** Portable balance row for UI — not Sui-specific beyond coinType string */
export type TokenBalanceView = {
  coinType: string;
  symbol: string;
  decimals: number;
  balanceRaw: string;
  balanceFormatted: string;
  usdValue?: string;
  /** Spot USD price per 1 token from Aftermath `Prices.getCoinsToPriceInfo` when available. */
  usdPricePerUnit?: number;
  /** 24h % change from Aftermath; the API may return 0 when 24h data is not supported. */
  usdPriceChange24hPct?: number;
  iconUrl?: string | null;
};

export type ChainActivityItem = {
  digest: string;
  timestamp: number | null;
  type: string;
  status: string;
  amount: string | null;
  symbol: string | null;
  sender: string | null;
  recipient: string | null;
  explorerUrl: string | null;
};

export type ChainActivityPage = {
  items: ChainActivityItem[];
  nextCursor: string | null;
};

export type NetworkUiSnapshot = {
  activeChain: ChainId;
  /** Active execution environment for the current chain (Sui cluster) */
  activeEnvironment: SuiChainEnvironment;
  rpcUrl: string;
  explorerBaseUrl: string;
  chainIdLabel: string;
};

export type TransferPrepareSummary = {
  coinType: string;
  symbol: string;
  decimals: number;
  amountRaw: string;
  amountFormatted: string;
  recipient: string;
  sender: string;
  gasBudgetMist: string;
  gasBudgetFormatted: string;
};

export type TransferPrepareResult = {
  transferRequestId: string;
  summary: TransferPrepareSummary;
};

export type TransferExecuteResult = {
  digest: string;
  explorerUrl: string | null;
};

export type SwapExecuteResult = {
  digest: string;
  explorerUrl: string | null;
};
