import { randomUUID } from "node:crypto";
import type { TriggerProposalResult } from "../../../assistant/assistantResultTypes";
import type { ActionContext } from "../../runtime/actionContext";
import type { TriggerApprovalLimits, TriggerDraft, TriggerProposalSnapshotV1 } from "./triggers.types";
import { categoryLabel } from "./triggerParser";
import {
  formatCountdown,
  formatLocalTime,
  formatScheduleDisplay,
  getCurrentTimezone,
} from "../../../services/time/time.service";

const PROPOSAL_TTL_MS = 10 * 60 * 1000;

function conditionSummary(draft: TriggerDraft): string {
  if (draft.type === "price") {
    const c = draft.condition as { asset: string; operator: string; priceUsd?: string };
    return `${c.asset} price ${c.operator} $${c.priceUsd ?? "?"}`;
  }
  if (draft.scheduleDisplay) return draft.scheduleDisplay;
  if (draft.type === "time") {
    return draft.description;
  }
  if (draft.schedule?.localTime) {
    const tz = draft.schedule.timezone || getCurrentTimezone();
    return `${draft.schedule.kind} at ${draft.schedule.localTime} (${tz})`;
  }
  return draft.description;
}

function actionSummary(draft: TriggerDraft): string {
  if (draft.action.type === "swap") {
    return `Swap ${draft.action.amount} ${draft.action.fromToken} → ${draft.action.toToken}`;
  }
  if (draft.action.type === "yield_collect") {
    return draft.action.mode === "all_pools"
      ? "Collect available Navi yield from all pools"
      : `Collect yield${draft.action.asset ? ` for ${draft.action.asset}` : ""}`;
  }
  return draft.description;
}

function scheduleCaption(draft: TriggerDraft): {
  scheduleDisplay?: string;
  nextExecutionLabel?: string;
  executionMode?: "one-time" | "recurring";
} {
  if (!draft.schedule) return {};
  const onceUtc = draft.schedule.onceAtUtc;
  const nextDate = onceUtc ? new Date(onceUtc) : null;
  const display =
    draft.scheduleDisplay ??
    (nextDate ? formatScheduleDisplay(nextDate, draft.schedule.timezone) : undefined);
  const countdown = nextDate ? formatCountdown(nextDate) : null;
  const nextExecutionLabel =
    display && countdown ? `${display} (${countdown})` : display ?? undefined;
  const recurring =
    draft.schedule.kind === "daily" ||
    draft.schedule.kind === "weekly" ||
    draft.schedule.kind === "interval_hours";
  return {
    scheduleDisplay: display,
    nextExecutionLabel,
    executionMode: recurring ? "recurring" : "one-time",
  };
}

export function buildApprovalPreview(
  draft: TriggerDraft,
  ctx: ActionContext,
): TriggerApprovalLimits | null {
  const account = ctx.wallet.getActiveAccount();
  if (!account) return null;

  const maxExec = draft.maxExecutions ?? (draft.type === "price" ? 1 : 9999);
  const slippage = draft.slippageBps ?? 50;

  if (draft.action.type === "swap") {
    return {
      approvedByAccountId: ctx.accountId,
      approvedWalletAddress: account.address,
      allowedActionType: "swap",
      maxAmountPerExecution: draft.action.amount,
      tokenIn: draft.action.fromToken,
      tokenOut: draft.action.toToken,
      maxSlippageBps: slippage,
      maxExecutions: maxExec,
      requireBalanceRecheck: true,
      requirePriceRecheck: draft.type === "price",
    };
  }

  if (draft.action.type === "yield_collect") {
    return {
      approvedByAccountId: ctx.accountId,
      approvedWalletAddress: account.address,
      allowedActionType: "yield_collect",
      maxAmountPerExecution: "max",
      tokenIn: draft.action.asset ?? "ALL",
      tokenOut: draft.action.asset ?? "ALL",
      maxSlippageBps: 0,
      maxExecutions: maxExec,
      requireBalanceRecheck: true,
      requirePriceRecheck: false,
    };
  }

  return null;
}

export function buildTriggerProposal(params: {
  draft: TriggerDraft;
  ctx: ActionContext;
  networkLabel: string;
}): TriggerProposalResult | { error: string } {
  const { draft, ctx, networkLabel } = params;
  const account = ctx.wallet.getActiveAccount();
  if (!account || account.chain !== "sui") {
    return { error: "Switch to a Sui account to create triggers." };
  }

  const net = ctx.network.getActiveNetwork();
  const approvalPreview = buildApprovalPreview(draft, ctx);
  if (!approvalPreview) {
    return { error: "Could not build approval limits for this trigger." };
  }

  const proposalId = randomUUID();
  const snapshot: TriggerProposalSnapshotV1 = {
    v: 1,
    proposalId,
    accountId: ctx.accountId,
    suiEnvironment: net.environment,
    walletAddress: account.address,
    draft,
    approvalPreview,
    expiresAtMs: Date.now() + PROPOSAL_TTL_MS,
  };

  const schedMeta = scheduleCaption(draft);
  const maxExec = draft.maxExecutions ?? (draft.type === "price" ? 1 : "recurring");
  const swapAction = draft.action.type === "swap" ? draft.action : null;
  const isScheduledSwap = draft.type === "time" && swapAction != null;
  const risks = [
    isScheduledSwap
      ? "Price may change before the scheduled execution time."
      : "Execution price may differ due to slippage.",
    "Triggers run while the app is open or in background-capable state — not when fully killed.",
    "You pre-approve limits now; execution stays within those bounds only.",
  ];

  const title = isScheduledSwap && swapAction
    ? `Scheduled swap: ${swapAction.fromToken} → ${swapAction.toToken}`
    : `Trigger: ${draft.name}`;

  const details: { k: string; v: string }[] = [
    { k: "Condition", v: conditionSummary(draft) },
    { k: "Action", v: actionSummary(draft) },
    { k: "Account", v: account.name },
    { k: "Network", v: networkLabel },
    { k: "Max executions", v: String(maxExec) },
    { k: "Slippage cap", v: `${approvalPreview.maxSlippageBps} bps` },
  ];
  if (schedMeta.scheduleDisplay) {
    details.splice(1, 0, { k: "Time", v: schedMeta.scheduleDisplay });
  }
  if (schedMeta.nextExecutionLabel) {
    details.push({ k: "Next execution", v: schedMeta.nextExecutionLabel });
  }
  if (schedMeta.executionMode) {
    details.push({ k: "Execution", v: schedMeta.executionMode === "one-time" ? "One-time" : "Recurring" });
  }
  details.push({ k: "Approval", v: "Runs automatically when due — only within pre-approved limits" });

  return {
    type: "trigger_proposal",
    proposalId,
    status: "pending",
    proposalSnapshot: snapshot,
    name: draft.name,
    triggerType: draft.type,
    conditionSummary: conditionSummary(draft),
    actionSummary: actionSummary(draft),
    accountLabel: account.name,
    network: networkLabel,
    maxExecutionsLabel: String(maxExec),
    slippageBps: approvalPreview.maxSlippageBps,
    scheduleLabel: schedMeta.scheduleDisplay,
    scheduleDisplay: schedMeta.scheduleDisplay,
    nextExecutionLabel: schedMeta.nextExecutionLabel,
    executionMode: schedMeta.executionMode,
    timezone: draft.schedule?.timezone ?? getCurrentTimezone(),
    localTimeNow: formatLocalTime(),
    riskNotes: risks,
    card: {
      title,
      label: isScheduledSwap ? "Scheduled swap" : categoryLabel(draft.type),
      source: { type: "core", name: "triggers" },
      flows: [],
      details,
      note: "Review and tap Approve Trigger to save. Nothing runs until you pre-approve.",
    },
  };
}
