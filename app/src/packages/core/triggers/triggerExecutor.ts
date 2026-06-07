import type { ActionContext } from "../../runtime/actionContext";
import { createActionContext } from "../../runtime/actionContext";
import { chainFacadeService } from "../../../main/services/chains/chainFacadeService";
import { suiNaviYieldService } from "../../../main/services/chains/sui/sui-navi-yield.service";
import { triggerRepository } from "../../../main/persistence/repositories/triggerRepository";
import { walletService } from "../../../main/wallet/walletService";
import { networkSettingsService } from "../../../main/services/network/networkSettingsService";
import { prepareSwapAction } from "../swap/swap.actions";
import { prepareYieldWithdrawAction } from "../yield/navi/navi.actions";
import { evaluateTriggerCondition } from "./triggerConditionEvaluator";
import { triggerStorageService } from "./triggerStorageService";
import type {
  TriggerAction,
  TriggerApprovalLimits,
  TriggerRecord,
  TriggerTimeSchedule,
} from "./triggers.types";
import { defaultNextCheckAtIso } from "../../../services/time/timeService";
import {
  DEFAULT_SLIPPAGE_BPS,
  SlippageError,
  toAftermathSlippage,
} from "../../../shared/swap/slippage";

export type TriggerExecutionOutcome = {
  status: "success" | "failed" | "skipped";
  txDigest?: string;
  error?: string;
};

function parseJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

function withinApproval(
  approval: TriggerApprovalLimits,
  action: TriggerAction,
  accountId: string,
  walletAddress: string,
): string | null {
  if (approval.approvedByAccountId !== accountId) {
    return "Account mismatch";
  }
  if (approval.approvedWalletAddress !== walletAddress) {
    return "Wallet address mismatch";
  }
  if (approval.expiresAt && new Date(approval.expiresAt).getTime() < Date.now()) {
    return "Trigger approval expired";
  }
  if (action.type !== approval.allowedActionType) {
    return "Action type not approved";
  }
  if (action.type === "swap") {
    const amt = parseFloat(action.amount);
    const max = parseFloat(approval.maxAmountPerExecution);
    if (Number.isFinite(amt) && Number.isFinite(max) && amt > max) {
      return "Amount exceeds approved max per execution";
    }
    if (action.fromToken.toUpperCase() !== approval.tokenIn.toUpperCase()) {
      return "tokenIn not approved";
    }
    if (action.toToken.toUpperCase() !== approval.tokenOut.toUpperCase()) {
      return "tokenOut not approved";
    }
    const slip = action.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
    if (slip > approval.maxSlippageBps) {
      return "Slippage exceeds approved cap";
    }
  }
  return null;
}

async function executeSwapTrigger(
  record: TriggerRecord,
  action: Extract<TriggerAction, { type: "swap" }>,
  ctx: ActionContext,
  approval: TriggerApprovalLimits,
): Promise<TriggerExecutionOutcome> {
  const slippageBps = Math.min(action.slippageBps ?? approval.maxSlippageBps, approval.maxSlippageBps);
  try {
    toAftermathSlippage(slippageBps);
  } catch (e) {
    const msg = e instanceof SlippageError ? e.message : "Invalid slippage for trigger execution.";
    return { status: "skipped", error: msg };
  }

  const blocks = await prepareSwapAction(
    {
      fromToken: action.fromToken,
      toToken: action.toToken,
      amount: action.amount,
      slippageBps,
    },
    ctx,
  );
  const head = blocks[0];
  if (!head || head.type !== "swap_proposal" || !head.proposalSnapshot) {
    const err =
      head?.type === "error" ? head.message : "Could not prepare swap for trigger execution.";
    return { status: "failed", error: err };
  }

  const snap = head.proposalSnapshot;
  if (snap.accountId !== record.accountId || snap.walletAddress !== approval.approvedWalletAddress) {
    return { status: "skipped", error: "Proposal snapshot account mismatch" };
  }

  try {
    const result = await chainFacadeService.executeAssistantSwap({
      accountId: record.accountId,
      proposalSnapshot: snap,
    });
    return { status: "success", txDigest: result.digest };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "Swap execution failed" };
  }
}

async function executeYieldTrigger(
  record: TriggerRecord,
  action: Extract<TriggerAction, { type: "yield_collect" }>,
  ctx: ActionContext,
  approval: TriggerApprovalLimits,
): Promise<TriggerExecutionOutcome> {
  const asset = action.asset ?? "USDC";
  const blocks = await prepareYieldWithdrawAction(
    {
      asset,
      amountKind: "interest",
    },
    ctx,
  );
  const head = blocks[0];
  if (!head || head.type !== "navi_withdraw_proposal" || !head.proposalSnapshot) {
    const err =
      head?.type === "error" ? head.message : "No yield available or could not prepare collect.";
    return { status: "skipped", error: err };
  }

  const snap = head.proposalSnapshot;
  if (snap.accountId !== record.accountId || snap.walletAddress !== approval.approvedWalletAddress) {
    return { status: "skipped", error: "Yield proposal account mismatch" };
  }

  try {
    const result = await suiNaviYieldService.executeApprovedProposal({
      accountId: record.accountId,
      proposalSnapshot: snap,
    });
    return { status: "success", txDigest: result.digest };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "Yield collect failed" };
  }
}

/**
 * Evaluate + execute a single trigger deterministically (no LLM).
 */
export async function executeTriggerIfDue(
  record: TriggerRecord,
  ctx?: ActionContext,
): Promise<TriggerExecutionOutcome> {
  if (record.status !== "active") {
    return { status: "skipped", error: `Trigger is ${record.status}` };
  }

  const account = walletService.getWalletAccount(record.accountId);
  if (!account) {
    return { status: "skipped", error: "Account not found" };
  }

  const activeId = walletService.getStatus().activeAccountId;
  if (activeId && activeId !== record.accountId) {
    return { status: "skipped", error: "Active account does not match trigger account" };
  }

  const approval = parseJson<TriggerApprovalLimits>(record.approvalJson);
  const action = parseJson<TriggerAction>(record.actionJson);
  const env = networkSettingsService.getSuiEnvironment();
  if (record.network !== env) {
    return { status: "skipped", error: "Network mismatch" };
  }

  const violation = withinApproval(approval, action, record.accountId, account.address);
  if (violation) {
    triggerStorageService.logExecution({
      triggerId: record.id,
      accountId: record.accountId,
      status: "skipped",
      conditionSnapshotJson: record.conditionJson,
      actionSnapshotJson: record.actionJson,
      error: violation,
    });
    return { status: "skipped", error: violation };
  }

  if (record.maxExecutions != null && record.executionCount >= record.maxExecutions) {
    triggerStorageService.patch(record.id, { status: "completed" });
    return { status: "skipped", error: "Max executions reached" };
  }

  const evalResult = await evaluateTriggerCondition(record);
  const now = new Date().toISOString();
  const schedule = record.scheduleJson
    ? (parseJson(record.scheduleJson) as TriggerTimeSchedule)
    : null;
  triggerStorageService.patch(record.id, {
    lastCheckedAt: now,
    nextCheckAt: defaultNextCheckAtIso(record.type, schedule),
  });

  if (!evalResult.met) {
    return { status: "skipped", error: evalResult.reason };
  }

  if (record.type === "portfolio") {
    triggerStorageService.logExecution({
      triggerId: record.id,
      accountId: record.accountId,
      status: "skipped",
      conditionSnapshotJson: JSON.stringify(evalResult.snapshot),
      actionSnapshotJson: record.actionJson,
      error: "Portfolio rebalance auto-execution not enabled in v1",
    });
    return { status: "skipped", error: "Portfolio auto-rebalance not enabled in v1" };
  }

  const resolvedCtx = ctx ?? createActionContext(record.accountId);

  let outcome: TriggerExecutionOutcome;
  if (action.type === "swap") {
    outcome = await executeSwapTrigger(record, action, resolvedCtx, approval);
  } else if (action.type === "yield_collect") {
    outcome = await executeYieldTrigger(record, action, resolvedCtx, approval);
  } else {
    outcome = { status: "skipped", error: "Unsupported action" };
  }

  const execStatus =
    outcome.status === "success" ? "success" : outcome.status === "failed" ? "failed" : "skipped";

  triggerStorageService.logExecution({
    triggerId: record.id,
    accountId: record.accountId,
    status: execStatus,
    conditionSnapshotJson: JSON.stringify(evalResult.snapshot),
    actionSnapshotJson: record.actionJson,
    txDigest: outcome.txDigest ?? null,
    error: outcome.error ?? null,
  });

  if (outcome.status === "success") {
    const newCount = record.executionCount + 1;
    const patch: Parameters<typeof triggerStorageService.patch>[1] = {
      lastTriggeredAt: now,
      executionCount: newCount,
    };
    if (record.maxExecutions != null && newCount >= record.maxExecutions) {
      patch.status = "completed";
    }
    triggerStorageService.patch(record.id, patch);
  }

  return outcome;
}

export async function executeDueTriggerById(triggerId: string): Promise<TriggerExecutionOutcome> {
  const row = triggerRepository.getById(triggerId);
  if (!row || row.status !== "active") {
    return { status: "skipped", error: "Trigger not found or not active" };
  }
  return executeTriggerIfDue(row);
}
