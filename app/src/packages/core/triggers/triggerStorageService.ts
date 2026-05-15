import { triggerRepository } from "../../../main/persistence/repositories/triggerRepository";
import type {
  TriggerApprovalLimits,
  TriggerDraft,
  TriggerExecutionRecord,
  TriggerRecord,
  TriggerStatus,
  TriggerTimeSchedule,
} from "./triggers.types";

export const triggerStorageService = {
  list(accountId: string): TriggerRecord[] {
    return triggerRepository.listByAccount(accountId);
  },

  get(id: string, accountId: string): TriggerRecord | null {
    return triggerRepository.getByIdForAccount(id, accountId);
  },

  listDue(nowIso: string, accountId?: string): TriggerRecord[] {
    return triggerRepository.listDueActive(nowIso, accountId);
  },

  saveApproved(input: {
    accountId: string;
    chain: string;
    network: string;
    draft: TriggerDraft;
    approval: TriggerApprovalLimits;
    schedule?: TriggerTimeSchedule | null;
    maxExecutions: number | null;
    nextCheckAt: string | null;
  }): TriggerRecord {
    return triggerRepository.create(input);
  },

  setStatus(id: string, accountId: string, status: TriggerStatus): TriggerRecord | null {
    return triggerRepository.updateStatus(id, accountId, status);
  },

  patch(id: string, patch: Parameters<typeof triggerRepository.patchScheduleAndChecks>[1]): void {
    triggerRepository.patchScheduleAndChecks(id, patch);
  },

  logExecution(
    input: Parameters<typeof triggerRepository.insertExecution>[0],
  ): TriggerExecutionRecord {
    return triggerRepository.insertExecution(input);
  },

  executions(triggerId: string, accountId: string): TriggerExecutionRecord[] {
    return triggerRepository.listExecutions(triggerId, accountId);
  },
};
