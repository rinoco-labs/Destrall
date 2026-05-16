/**
 * Structured assistant turn payloads (persisted in assistant_messages.metadata, JSON).
 * The UI maps each entry to rich cards — not plain markdown.
 */

import type { SendProposalSnapshot } from "../packages/runtime/transactionProposalTypes";
import type { SwapProposalSnapshotV1 } from "@packages/core/swap/swap.types";
import type { NaviYieldProposalSnapshotV1 } from "@packages/core/yield/navi/navi.types";
import type {
  CompositeProposalSnapshotV1,
  CompositeStepPreview,
} from "@packages/runtime/composite/compositeTypes";
import type { RebalanceProposalSnapshotV1 } from "@packages/core/rebalance/rebalance.types";
import type { TriggerProposalSnapshotV1, TriggerCategory, TriggerStatus } from "@packages/core/triggers/triggers.types";

export type AssistantAssetFlow = {
  direction: "out" | "in";
  amount: string;
  token: string;
  kind: "token" | "object";
  objectName?: string;
};

export type AssistantProposalCard = {
  title: string;
  label: string;
  source: { type: "core" | "package"; name: string };
  flows: AssistantAssetFlow[];
  details: { k: string; v: string }[];
  note: string;
};

export type PortfolioSummaryResult = {
  type: "portfolio_summary";
  network: string;
  totalUsd?: string;
  /** Optional short risk / concentration line when derived without fabricated prices */
  concentrationNote?: string;
  assets: Array<{
    symbol: string;
    name: string;
    balanceFormatted: string;
    valueUsd?: string;
    changePercent24h?: number;
    coinType?: string;
  }>;
};

export type YieldPositionsResult = {
  type: "yield_positions";
  network: string;
  totalUsd?: string;
  positions: Array<{
    protocol: string;
    asset: string;
    supplied: string;
    currentValue?: string;
    accruedInterest?: string;
    apy?: string;
    valueUsd?: string;
    coinType?: string;
    poolObjectId?: string;
    riskLabel?: string;
  }>;
  emptyHint?: string;
};

export type AvailableYieldPoolsResult = {
  type: "available_yield_pools";
  network: string;
  protocolLabel: string;
  recommendationNote?: string;
  pools: Array<{
    protocol: string;
    asset: string;
    apy?: string;
    tvlUsd?: string;
    utilization?: string;
    riskLabel?: string;
    coinType?: string;
  }>;
  emptyHint?: string;
};

export type SwappableTokensResult = {
  type: "swappable_tokens";
  network: string;
  routerLabel: string;
  coins: Array<{
    symbol: string;
    name: string;
    network?: string;
    liquidityUsd?: string;
    routerStatus?: string;
    coinType?: string;
    decimals?: number;
    iconUrl?: string;
  }>;
  emptyHint?: string;
};

export type SendProposalResult = {
  type: "send_proposal";
  proposalId: string;
  status: "pending" | "executing" | "success" | "failed" | "rejected";
  transferRequestId?: string;
  errorMessage?: string;
  digest?: string;
  explorerUrl?: string | null;
  /** Filled when a named contact matched; shown on the card. */
  recipientDisplayName?: string;
  /** Re-validated on approve so account/network drift cannot execute a stale proposal. */
  proposalSnapshot?: SendProposalSnapshot;
  card: AssistantProposalCard;
};

/** User must pick one contact / account when multiple names match. */
export type ContactDisambiguationResult = {
  type: "contact_disambiguation";
  disambiguationId: string;
  token: string;
  amount: string;
  originalRecipientQuery: string;
  matches: Array<{ id: string; name: string; address: string }>;
};

export type SwapProposalResult = {
  type: "swap_proposal";
  proposalId: string;
  status: "pending" | "executing" | "success" | "failed" | "rejected";
  errorMessage?: string;
  digest?: string;
  explorerUrl?: string | null;
  /** Persisted for reload + execution validation (no secrets). */
  proposalSnapshot?: SwapProposalSnapshotV1;
  card: AssistantProposalCard;
};

/** Active account Sui address (read-only card with copy). */
export type WalletAddressResult = {
  type: "wallet_address";
  network: string;
  accountLabel: string;
  address: string;
};

/** Swap + Navi deposit — single PTB on mainnet when possible. */
export type CompositeSwapThenDepositResult = {
  type: "composite_swap_then_deposit";
  compositeId: string;
  proposalId: string;
  status: "pending" | "executing" | "success" | "failed" | "rejected";
  executionModel: "ptb" | "staged";
  steps: CompositeStepPreview[];
  proposalSnapshot?: CompositeProposalSnapshotV1;
  card: AssistantProposalCard;
  swapProposal: SwapProposalResult;
  depositPreview: {
    asset: string;
    amountDisplay: string;
    poolLabel: string;
    apyText?: string;
  };
  riskNotes: string[];
  errorMessage?: string;
  digest?: string;
  explorerUrl?: string | null;
};

export type RebalanceProposalResult = {
  type: "rebalance_proposal";
  proposalId: string;
  status?: "pending" | "executing" | "success" | "failed" | "rejected";
  network: string;
  currentPct: { symbol: string; pct: string; valueUsd?: string }[];
  targetPct: { symbol: string; pct: string }[];
  swaps: { fromSymbol: string; toSymbol: string; amountDisplay: string; note?: string }[];
  gasNote?: string;
  dustSkipped?: string[];
  riskNotes: string[];
  proposalSnapshot?: RebalanceProposalSnapshotV1;
  executable?: boolean;
  errorMessage?: string;
  digest?: string;
  explorerUrl?: string | null;
};

export type SwapExecutionResultResult = {
  type: "swap_execution_result";
  title: string;
  digest: string;
  explorerUrl?: string | null;
  summary: string;
};

export type NaviDepositProposalResult = {
  type: "navi_deposit_proposal";
  proposalId: string;
  status: "pending" | "executing" | "success" | "failed" | "rejected";
  errorMessage?: string;
  digest?: string;
  explorerUrl?: string | null;
  proposalSnapshot?: NaviYieldProposalSnapshotV1;
  card: AssistantProposalCard;
};

export type NaviWithdrawProposalResult = {
  type: "navi_withdraw_proposal";
  proposalId: string;
  status: "pending" | "executing" | "success" | "failed" | "rejected";
  errorMessage?: string;
  digest?: string;
  explorerUrl?: string | null;
  proposalSnapshot?: NaviYieldProposalSnapshotV1;
  card: AssistantProposalCard;
};

export type YieldExecutionResultResult = {
  type: "yield_execution_result";
  title: string;
  digest: string;
  explorerUrl?: string | null;
  summary: string;
  kind?: "deposit" | "withdraw";
};

export type TransactionResultResult = {
  type: "transaction_result";
  title: string;
  digest: string;
  explorerUrl?: string | null;
  summary: string;
};

export type TriggerProposalResult = {
  type: "trigger_proposal";
  proposalId: string;
  status: "pending" | "approved" | "rejected";
  proposalSnapshot?: TriggerProposalSnapshotV1;
  name: string;
  triggerType: TriggerCategory;
  conditionSummary: string;
  actionSummary: string;
  accountLabel: string;
  network: string;
  maxExecutionsLabel: string;
  slippageBps: number;
  scheduleLabel?: string;
  /** Readable: May 15 • 6:00 AM • Asia/Ho_Chi_Minh */
  scheduleDisplay?: string;
  nextExecutionLabel?: string;
  executionMode?: "one-time" | "recurring";
  timezone: string;
  localTimeNow: string;
  riskNotes: string[];
  card: AssistantProposalCard;
};

export type TimeInfoResult = {
  type: "time_info";
  localTime: string;
  timezone: string;
  utcTime: string;
  formatted: string;
  weekday: string;
  utcOffset: string;
};

export type TriggerListResult = {
  type: "trigger_list";
  triggers: Array<{
    id: string;
    name: string;
    type: TriggerCategory;
    typeLabel: string;
    status: TriggerStatus;
    conditionSummary: string;
    actionSummary: string;
    nextCheckAt: string | null;
    nextCheckLabel?: string | null;
    lastTriggeredAt: string | null;
    executionCount: number;
    maxExecutions: number | null;
  }>;
};

export type AssistantErrorResult = {
  type: "error";
  message: string;
  code?: string;
};

export type AssistantCapabilityToolRow = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  examples: string[];
  approvalNote: string;
  risks: string[];
};

export type AssistantCapabilitiesResult = {
  type: "assistant_capabilities";
  title: string;
  subtitle: string;
  tools: AssistantCapabilityToolRow[];
  /** When set, that tool row starts expanded (e.g. “how do triggers work?”). */
  highlightToolId?: string;
};

export type AssistantStructuredResult =
  | PortfolioSummaryResult
  | WalletAddressResult
  | YieldPositionsResult
  | AvailableYieldPoolsResult
  | SwappableTokensResult
  | SendProposalResult
  | ContactDisambiguationResult
  | SwapProposalResult
  | NaviDepositProposalResult
  | NaviWithdrawProposalResult
  | CompositeSwapThenDepositResult
  | RebalanceProposalResult
  | TransactionResultResult
  | SwapExecutionResultResult
  | YieldExecutionResultResult
  | TriggerProposalResult
  | TriggerListResult
  | TimeInfoResult
  | AssistantCapabilitiesResult
  | AssistantErrorResult;

export type AssistantMessageMetadataV1 = {
  v: 1;
  structured: AssistantStructuredResult[];
};

export function isProposalStructuredResult(
  r: AssistantStructuredResult,
): r is
  | SendProposalResult
  | SwapProposalResult
  | NaviDepositProposalResult
  | NaviWithdrawProposalResult
  | TriggerProposalResult {
  return (
    r.type === "send_proposal" ||
    r.type === "swap_proposal" ||
    r.type === "navi_deposit_proposal" ||
    r.type === "navi_withdraw_proposal" ||
    r.type === "trigger_proposal"
  );
}
