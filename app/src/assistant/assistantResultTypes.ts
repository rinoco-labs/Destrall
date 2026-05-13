/**
 * Structured assistant turn payloads (persisted in assistant_messages.metadata, JSON).
 * The UI maps each entry to rich cards — not plain markdown.
 */

import type { SendProposalSnapshot } from "../packages/runtime/transactionProposalTypes";
import type { SwapProposalSnapshotV1 } from "@packages/core/swap/swap.types";
import type { NaviYieldProposalSnapshotV1 } from "@packages/core/yield/navi/navi.types";

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

export type AssistantErrorResult = {
  type: "error";
  message: string;
  code?: string;
};

export type AssistantStructuredResult =
  | PortfolioSummaryResult
  | YieldPositionsResult
  | AvailableYieldPoolsResult
  | SwappableTokensResult
  | SendProposalResult
  | ContactDisambiguationResult
  | SwapProposalResult
  | NaviDepositProposalResult
  | NaviWithdrawProposalResult
  | TransactionResultResult
  | SwapExecutionResultResult
  | YieldExecutionResultResult
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
  | NaviWithdrawProposalResult {
  return (
    r.type === "send_proposal" ||
    r.type === "swap_proposal" ||
    r.type === "navi_deposit_proposal" ||
    r.type === "navi_withdraw_proposal"
  );
}
