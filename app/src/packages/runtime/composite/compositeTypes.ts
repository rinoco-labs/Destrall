import type { SuiChainEnvironment } from "../../../config/chains/sui";
import type { SwapProposalSnapshotV1 } from "../../core/swap/swap.types";
import type { NaviYieldProposalSnapshotV1 } from "../../core/yield/navi/navi.types";

export type CompositeStepType = "swap" | "yield_deposit" | "yield_withdraw" | "rebalance_swap";

export type CompositeExecutionStep = {
  id: string;
  type: CompositeStepType;
  package: string;
  label: string;
  outputAlias?: string;
  inputFromAlias?: string;
  /** Display-only metadata for proposal cards */
  preview?: {
    fromSymbol?: string;
    toSymbol?: string;
    amountDisplay?: string;
    asset?: string;
    poolLabel?: string;
    apyText?: string;
  };
};

export type CompositeExecutionPlan = {
  planId: string;
  kind: "swap_then_deposit" | "rebalance" | "withdraw_then_rebalance";
  steps: CompositeExecutionStep[];
  /** When true, all steps share one PTB; otherwise sequential txs */
  singlePtb: boolean;
};

export type CompositeProposalSnapshotV1 = {
  v: 1;
  compositeId: string;
  planId: string;
  accountId: string;
  suiEnvironment: SuiChainEnvironment;
  walletAddress: string;
  executionModel: "ptb" | "staged";
  planJson: string;
  preparedAtMs: number;
  expiresAtMs: number;
  swapSnapshot?: SwapProposalSnapshotV1;
  depositSnapshot?: NaviYieldProposalSnapshotV1;
  slippageBps?: number;
};

export type CompositeStepPreview = {
  index: number;
  label: string;
  detail?: string;
};
