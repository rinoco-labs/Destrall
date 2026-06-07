import { randomUUID } from "node:crypto";
import type { TriggerProposalResult } from "../../../assistant/assistantResultTypes";
import type { ActionContext } from "../../runtime/actionContext";
import type {
  TriggerApprovalLimits,
  TriggerDraft,
  TriggerPriceCondition,
  TriggerProposalSnapshotV1,
} from "./triggers.types";
import { categoryLabel } from "./triggerParser";
import {
  formatCountdown,
  formatLocalTime,
  formatScheduleDisplay,
  getCurrentTimezone,
} from "../../../services/time/time.service";
import { priceService } from "../../../services/prices/priceService";

const PROPOSAL_TTL_MS = 10 * 60 * 1000;

function formatOperatorLabel(op: string): string {
  switch (op) {
    case "below":
      return "<=";
    case "above":
      return ">=";
    case "target":
      return "≈";
    default:
      return op;
  }
}

function conditionSummary(draft: TriggerDraft): string {
  if (draft.type === "price") {
    const c = draft.condition as TriggerPriceCondition;
    const op = formatOperatorLabel(c.operator);
    return `${c.asset} price ${op} $${c.priceUsd ?? "?"}`;
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
  if (draft.action.type === "yield_deposit") {
    return `Deposit ${draft.action.amount} ${draft.action.asset} into Navi yield`;
  }
  if (draft.action.type === "yield_withdraw") {
    if (draft.action.amountKind === "all") {
      return `Withdraw all ${draft.action.asset} from Navi yield`;
    }
    return `Withdraw ${draft.action.amount ?? ""} ${draft.action.asset} from Navi yield`.trim();
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

  if (draft.action.type === "yield_deposit") {
    return {
      approvedByAccountId: ctx.accountId,
      approvedWalletAddress: account.address,
      allowedActionType: "yield_deposit",
      maxAmountPerExecution: draft.action.amount,
      tokenIn: draft.action.asset,
      tokenOut: draft.action.asset,
      maxSlippageBps: 0,
      maxExecutions: maxExec,
      requireBalanceRecheck: true,
      requirePriceRecheck: false,
    };
  }

  if (draft.action.type === "yield_withdraw") {
    return {
      approvedByAccountId: ctx.accountId,
      approvedWalletAddress: account.address,
      allowedActionType: "yield_withdraw",
      maxAmountPerExecution: draft.action.amount ?? "max",
      tokenIn: draft.action.asset,
      tokenOut: draft.action.asset,
      maxSlippageBps: 0,
      maxExecutions: maxExec,
      requireBalanceRecheck: true,
      requirePriceRecheck: false,
    };
  }

  return null;
}

async function balanceNoteForDraft(draft: TriggerDraft, ctx: ActionContext): Promise<string | null> {
  const balances = await ctx.wallet.getBalances();
  let spendSymbol: string | null = null;
  let spendAmount: string | null = null;

  if (draft.action.type === "swap") {
    spendSymbol = draft.action.fromToken;
    spendAmount = draft.action.amount;
  } else if (draft.action.type === "yield_deposit") {
    spendSymbol = draft.action.asset;
    spendAmount = draft.action.amount;
  }

  if (!spendSymbol) return null;

  const row = balances.find((b) => b.symbol.toUpperCase() === spendSymbol!.toUpperCase());
  const bal = row?.balanceFormatted ?? "0";
  return `You currently have ${bal} ${spendSymbol}. This trigger will attempt to spend ${spendAmount ?? "up to the approved amount"} ${spendSymbol} when the condition is met. If your balance changes before then, execution may fail.`;
}

export async function buildTriggerProposal(params: {
  draft: TriggerDraft;
  ctx: ActionContext;
  networkLabel: string;
}): Promise<TriggerProposalResult | { error: string }> {
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
  const balanceNote = await balanceNoteForDraft(draft, ctx);

  let priceSourceLabel: string | undefined;
  if (draft.type === "price") {
    const cond = draft.condition as TriggerPriceCondition;
    const quote = await priceService.getTokenPriceBySymbol(cond.asset);
    priceSourceLabel = quote?.source ?? "configured price feed";
  }

  const risks = [
    isScheduledSwap
      ? "Price may change before the scheduled execution time."
      : "Execution price may differ due to slippage.",
    "Triggers run while the app is open or in background-capable state — not when fully killed.",
    "You pre-approve limits now; execution stays within those bounds only.",
  ];
  if (balanceNote) risks.unshift(balanceNote);

  const title = isScheduledSwap && swapAction
    ? `Scheduled swap: ${swapAction.fromToken} → ${swapAction.toToken}`
    : `Trigger: ${draft.name}`;

  const shortAddr = `${account.address.slice(0, 6)}…${account.address.slice(-4)}`;
  const details: { k: string; v: string }[] = [
    { k: "Condition", v: conditionSummary(draft) },
    { k: "Action", v: actionSummary(draft) },
    { k: "Account", v: `${account.name} (${shortAddr})` },
    { k: "Network", v: networkLabel },
    { k: "Max executions", v: String(maxExec) },
    { k: "Slippage cap", v: `${approvalPreview.maxSlippageBps} bps` },
  ];
  if (priceSourceLabel) {
    details.splice(2, 0, { k: "Price source", v: priceSourceLabel });
  }
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
      note: "I prepared a trigger for review. Tap Approve Trigger to save — nothing runs until you pre-approve.",
    },
  };
}
