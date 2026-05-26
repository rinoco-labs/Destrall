import type { TriggerExecutionRecord, TriggerProposalSnapshotV1, TriggerRecord } from "@packages/core/triggers/triggers.types";
import type { RpcResult } from "../../shared/ipc";
import { isDestrallDesktop } from "@/lib/desktopWallet";
import { shortTriggerAccountId } from "../../services/triggers/triggerDebug";

async function unwrap<T>(result: Promise<RpcResult<T>>): Promise<T> {
  const response = await result;
  if (response.ok === false) {
    throw new Error(response.error);
  }
  return response.data;
}

function triggersApi() {
  if (!isDestrallDesktop() || !window.destrallApi) {
    throw new Error("Trigger services are only available in the Destrall desktop app.");
  }
  return window.destrallApi.triggers;
}

export async function desktopTriggersList(accountId: string): Promise<TriggerRecord[]> {
  const rows = await unwrap(triggersApi().list(accountId));
  if (import.meta.env.DEV) {
    console.debug("[triggers] loaded triggers", {
      count: rows.length,
      accountId: shortTriggerAccountId(accountId),
    });
  }
  return rows;
}

export async function desktopTriggersApprove(payload: {
  accountId: string;
  proposalSnapshot: TriggerProposalSnapshotV1;
}): Promise<TriggerRecord> {
  return unwrap(triggersApi().approve(payload));
}

export async function desktopTriggersPause(accountId: string, triggerId: string): Promise<TriggerRecord> {
  const row = await unwrap(triggersApi().pause({ accountId, triggerId }));
  if (import.meta.env.DEV) {
    console.debug("[triggers] updated trigger status", { triggerId, status: "paused" });
  }
  return row;
}

export async function desktopTriggersResume(accountId: string, triggerId: string): Promise<TriggerRecord> {
  const row = await unwrap(triggersApi().resume({ accountId, triggerId }));
  if (import.meta.env.DEV) {
    console.debug("[triggers] updated trigger status", { triggerId, status: "active" });
  }
  return row;
}

export async function desktopTriggersDelete(accountId: string, triggerId: string): Promise<TriggerRecord> {
  const row = await unwrap(triggersApi().delete({ accountId, triggerId }));
  if (import.meta.env.DEV) {
    console.debug("[triggers] deleted trigger", { triggerId });
  }
  return row;
}

export async function desktopTriggersExecutions(
  accountId: string,
  triggerId: string,
): Promise<TriggerExecutionRecord[]> {
  return unwrap(triggersApi().executions({ accountId, triggerId }));
}
