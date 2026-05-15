import { ipcMain } from "electron";
import { z } from "zod";
import { IPCChannels, type RpcResult } from "../../shared/ipc";
import { triggerRepository } from "../persistence/repositories/triggerRepository";
import { persistApprovedTrigger } from "../../packages/core/triggers/triggers.actions";
import { runTriggerSchedulerNow } from "../../packages/core/triggers/triggerScheduler";
import { walletService } from "../wallet/walletService";
import { networkSettingsService } from "../services/network/networkSettingsService";
import type { TriggerProposalSnapshotV1 } from "../../packages/core/triggers/triggers.types";

function ok<T>(data: T): RpcResult<T> {
  return { ok: true, data };
}

function fail(error: unknown): RpcResult<never> {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message };
}

const approveTriggerSchema = z.object({
  accountId: z.string().min(1),
  proposalSnapshot: z.custom<TriggerProposalSnapshotV1>(),
});

const accountTriggerSchema = z.object({
  accountId: z.string().min(1),
});

const triggerIdSchema = z.object({
  accountId: z.string().min(1),
  triggerId: z.string().min(1),
});

export function registerTriggersIpcHandlers() {
  ipcMain.handle(IPCChannels.triggersList, async (_event, payload: unknown) => {
    const parsed = accountTriggerSchema.safeParse(payload);
    if (!parsed.success) return fail(new Error("Invalid request"));
    try {
      const rows = triggerRepository.listByAccount(parsed.data.accountId);
      return ok(rows);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle(IPCChannels.triggersApprove, async (_event, payload: unknown) => {
    const parsed = approveTriggerSchema.safeParse(payload);
    if (!parsed.success) return fail(new Error("Invalid approve request"));
    try {
      const snap = parsed.data.proposalSnapshot;
      if (snap.v !== 1) return fail(new Error("Unsupported proposal version"));
      if (snap.accountId !== parsed.data.accountId) {
        return fail(new Error("Account mismatch"));
      }
      if (snap.expiresAtMs < Date.now()) {
        return fail(new Error("Trigger proposal expired — create a new one"));
      }
      const account = walletService.getWalletAccount(parsed.data.accountId);
      if (!account) return fail(new Error("Account not found"));
      if (account.address !== snap.walletAddress) {
        return fail(new Error("Wallet address changed since proposal"));
      }
      const env = networkSettingsService.getSuiEnvironment();
      if (snap.suiEnvironment !== env) {
        return fail(new Error("Network changed since proposal"));
      }

      const saved = persistApprovedTrigger({
        accountId: parsed.data.accountId,
        chain: account.chain,
        network: env,
        draft: snap.draft,
        approval: snap.approvalPreview,
      });
      runTriggerSchedulerNow(parsed.data.accountId);
      return ok(saved);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle(IPCChannels.triggersPause, async (_event, payload: unknown) => {
    const parsed = triggerIdSchema.safeParse(payload);
    if (!parsed.success) return fail(new Error("Invalid request"));
    try {
      const row = triggerRepository.updateStatus(parsed.data.triggerId, parsed.data.accountId, "paused");
      if (!row) return fail(new Error("Trigger not found"));
      return ok(row);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle(IPCChannels.triggersResume, async (_event, payload: unknown) => {
    const parsed = triggerIdSchema.safeParse(payload);
    if (!parsed.success) return fail(new Error("Invalid request"));
    try {
      const row = triggerRepository.updateStatus(parsed.data.triggerId, parsed.data.accountId, "active");
      if (!row) return fail(new Error("Trigger not found"));
      runTriggerSchedulerNow(parsed.data.accountId);
      return ok(row);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle(IPCChannels.triggersDelete, async (_event, payload: unknown) => {
    const parsed = triggerIdSchema.safeParse(payload);
    if (!parsed.success) return fail(new Error("Invalid request"));
    try {
      const row = triggerRepository.updateStatus(parsed.data.triggerId, parsed.data.accountId, "deleted");
      if (!row) return fail(new Error("Trigger not found"));
      return ok(row);
    } catch (e) {
      return fail(e);
    }
  });

  ipcMain.handle(IPCChannels.triggersExecutions, async (_event, payload: unknown) => {
    const parsed = triggerIdSchema.safeParse(payload);
    if (!parsed.success) return fail(new Error("Invalid request"));
    try {
      const rows = triggerRepository.listExecutions(parsed.data.triggerId, parsed.data.accountId);
      return ok(rows);
    } catch (e) {
      return fail(e);
    }
  });
}
