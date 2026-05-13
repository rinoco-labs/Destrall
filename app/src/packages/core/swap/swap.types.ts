import type { SuiChainEnvironment } from "../../../config/chains/sui";

export type SwapProposalSnapshotV1 = {
  v: 1;
  accountId: string;
  suiEnvironment: SuiChainEnvironment;
  walletAddress: string;
  fromCoinType: string;
  toCoinType: string;
  fromSymbol: string;
  toSymbol: string;
  amountDisplay: string;
  coinInAmountRaw: string;
  estimatedOutRaw: string;
  slippageBps: number;
  appFeeBps: number;
  treasuryAddress?: string;
  quoteExpiresAtMs: number;
  completeRouteJson: string;
};

export type SwappableTokenView = {
  symbol: string;
  name?: string;
  coinType: string;
  decimals?: number;
  iconUrl?: string;
  liquidityUsd?: string;
  /** Aftermath router support label for assistant bubbles (not USD liquidity). */
  routerStatus?: string;
  network: string;
};
