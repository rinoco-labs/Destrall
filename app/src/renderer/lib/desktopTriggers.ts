import type { TriggerExecutionRecord, TriggerProposalSnapshotV1, TriggerRecord } from "@packages/core/triggers/triggers.types";
import type { RpcResult } from "../../shared/ipc";

async function unwrap<T>(result: Promise<RpcResult<T>>): Promise<T> {
  const response = await result;
  if (response.ok === false) {
    throw new Error(response.error);
  }
  return response.data;
}

export async function desktopTriggersList(accountId: string): Promise<TriggerRecord[]> {
  return unwrap(window.destrallApi.triggers.list(accountId));
}

export async function desktopTriggersApprove(payload: {
  accountId: string;
  proposalSnapshot: TriggerProposalSnapshotV1;
}): Promise<TriggerRecord> {
  return unwrap(window.destrallApi.triggers.approve(payload));
}

export async function desktopTriggersPause(accountId: string, triggerId: string): Promise<TriggerRecord> {
  return unwrap(window.destrallApi.triggers.pause({ accountId, triggerId }));
}

export async function desktopTriggersResume(accountId: string, triggerId: string): Promise<TriggerRecord> {
  return unwrap(window.destrallApi.triggers.resume({ accountId, triggerId }));
}

export async function desktopTriggersDelete(accountId: string, triggerId: string): Promise<TriggerRecord> {
  return unwrap(window.destrallApi.triggers.delete({ accountId, triggerId }));
}

export async function desktopTriggersExecutions(
  accountId: string,
  triggerId: string,
): Promise<TriggerExecutionRecord[]> {
  return unwrap(window.destrallApi.triggers.executions({ accountId, triggerId }));
}
