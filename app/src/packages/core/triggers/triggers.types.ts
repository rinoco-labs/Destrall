import type { SuiChainEnvironment } from "../../../config/chains/sui";

export type TriggerStatus = "active" | "paused" | "completed" | "failed" | "deleted";

export type TriggerExecutionStatus = "pending" | "executing" | "success" | "failed" | "skipped";

export type TriggerCategory = "price" | "time" | "yield" | "portfolio";

export type PriceConditionOperator = "above" | "below" | "percent_change" | "target";

export type TriggerPriceCondition = {
  asset: string;
  coinType?: string;
  operator: PriceConditionOperator;
  priceUsd?: string;
  percentChange?: string;
  direction?: "up" | "down";
  /** Set when "at $X" needs live price to pick above vs below. */
  needsAtResolution?: boolean;
};

export type TriggerTimeSchedule = {
  kind: "daily" | "weekly" | "interval_hours" | "once";
  /** Local time HH:mm (24h) for daily/weekly */
  localTime?: string;
  /** 0=Sunday … 6=Saturday for weekly */
  weekday?: number;
  intervalHours?: number;
  /** ISO UTC for once */
  onceAtUtc?: string;
  timezone: string;
};

export type TriggerSwapAction = {
  type: "swap";
  fromToken: string;
  toToken: string;
  amount: string;
  slippageBps?: number;
};

export type TriggerYieldCollectAction = {
  type: "yield_collect";
  mode: "all_pools" | "interest";
  asset?: string;
};

export type TriggerYieldDepositAction = {
  type: "yield_deposit";
  asset: string;
  amount: string;
};

export type TriggerYieldWithdrawAction = {
  type: "yield_withdraw";
  asset: string;
  amountKind: "absolute" | "all" | "percentage";
  amount?: string;
};

export type TriggerAction =
  | TriggerSwapAction
  | TriggerYieldCollectAction
  | TriggerYieldDepositAction
  | TriggerYieldWithdrawAction;

export type TriggerApprovalLimits = {
  approvedAt?: string;
  approvedByAccountId: string;
  approvedWalletAddress: string;
  allowedActionType: TriggerAction["type"];
  maxAmountPerExecution: string;
  tokenIn: string;
  tokenOut: string;
  maxSlippageBps: number;
  maxExecutions: number;
  expiresAt?: string;
  requireBalanceRecheck: boolean;
  requirePriceRecheck: boolean;
};

export type TriggerDraft = {
  type: TriggerCategory;
  name: string;
  description: string;
  condition: TriggerPriceCondition | Record<string, unknown>;
  action: TriggerAction;
  schedule?: TriggerTimeSchedule;
  /** Human-readable schedule for cards */
  scheduleDisplay?: string;
  maxExecutions?: number;
  slippageBps?: number;
};

export type TriggerRecord = {
  id: string;
  accountId: string;
  chain: string;
  network: string;
  name: string;
  description: string;
  type: TriggerCategory;
  status: TriggerStatus;
  conditionJson: string;
  actionJson: string;
  approvalJson: string;
  scheduleJson: string | null;
  lastCheckedAt: string | null;
  lastTriggeredAt: string | null;
  nextCheckAt: string | null;
  executionCount: number;
  maxExecutions: number | null;
  createdAt: string;
  updatedAt: string;
};

export type TriggerExecutionRecord = {
  id: string;
  triggerId: string;
  accountId: string;
  status: TriggerExecutionStatus;
  conditionSnapshotJson: string;
  actionSnapshotJson: string;
  txDigest: string | null;
  error: string | null;
  executedAt: string;
};

export type TriggerProposalSnapshotV1 = {
  v: 1;
  proposalId: string;
  accountId: string;
  suiEnvironment: SuiChainEnvironment;
  walletAddress: string;
  draft: TriggerDraft;
  approvalPreview: TriggerApprovalLimits;
  expiresAtMs: number;
};
