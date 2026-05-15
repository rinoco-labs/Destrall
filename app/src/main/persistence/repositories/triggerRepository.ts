import { randomUUID } from "node:crypto";
import { getDatabase } from "../database";
import type {
  TriggerApprovalLimits,
  TriggerCategory,
  TriggerDraft,
  TriggerExecutionRecord,
  TriggerExecutionStatus,
  TriggerRecord,
  TriggerStatus,
  TriggerTimeSchedule,
} from "../../../packages/core/triggers/triggers.types";

type TriggerRow = {
  id: string;
  account_id: string;
  chain: string;
  network: string;
  name: string;
  description: string;
  type: string;
  status: string;
  condition_json: string;
  action_json: string;
  approval_json: string;
  schedule_json: string | null;
  last_checked_at: string | null;
  last_triggered_at: string | null;
  next_check_at: string | null;
  execution_count: number;
  max_executions: number | null;
  created_at: string;
  updated_at: string;
};

type ExecutionRow = {
  id: string;
  trigger_id: string;
  account_id: string;
  status: string;
  condition_snapshot_json: string;
  action_snapshot_json: string;
  tx_digest: string | null;
  error: string | null;
  executed_at: string;
};

function mapTrigger(row: TriggerRow): TriggerRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    chain: row.chain,
    network: row.network,
    name: row.name,
    description: row.description,
    type: row.type as TriggerCategory,
    status: row.status as TriggerStatus,
    conditionJson: row.condition_json,
    actionJson: row.action_json,
    approvalJson: row.approval_json,
    scheduleJson: row.schedule_json,
    lastCheckedAt: row.last_checked_at,
    lastTriggeredAt: row.last_triggered_at,
    nextCheckAt: row.next_check_at,
    executionCount: row.execution_count,
    maxExecutions: row.max_executions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExecution(row: ExecutionRow): TriggerExecutionRecord {
  return {
    id: row.id,
    triggerId: row.trigger_id,
    accountId: row.account_id,
    status: row.status as TriggerExecutionStatus,
    conditionSnapshotJson: row.condition_snapshot_json,
    actionSnapshotJson: row.action_snapshot_json,
    txDigest: row.tx_digest,
    error: row.error,
    executedAt: row.executed_at,
  };
}

export class TriggerRepository {
  private readonly db = getDatabase();

  listByAccount(accountId: string, statusFilter?: TriggerStatus[]): TriggerRecord[] {
    if (statusFilter?.length) {
      const placeholders = statusFilter.map(() => "?").join(", ");
      const rows = this.db
        .prepare(
          `SELECT * FROM triggers WHERE account_id = ? AND status IN (${placeholders}) ORDER BY created_at DESC`,
        )
        .all(accountId, ...statusFilter) as TriggerRow[];
      return rows.map(mapTrigger);
    }
    const rows = this.db
      .prepare(`SELECT * FROM triggers WHERE account_id = ? AND status != 'deleted' ORDER BY created_at DESC`)
      .all(accountId) as TriggerRow[];
    return rows.map(mapTrigger);
  }

  listDueActive(nowIso: string, accountId?: string): TriggerRecord[] {
    if (accountId) {
      const rows = this.db
        .prepare(
          `SELECT * FROM triggers
           WHERE account_id = ? AND status = 'active'
             AND (next_check_at IS NULL OR next_check_at <= ?)
           ORDER BY next_check_at ASC`,
        )
        .all(accountId, nowIso) as TriggerRow[];
      return rows.map(mapTrigger);
    }
    const rows = this.db
      .prepare(
        `SELECT * FROM triggers
         WHERE status = 'active' AND (next_check_at IS NULL OR next_check_at <= ?)
         ORDER BY next_check_at ASC`,
      )
      .all(nowIso) as TriggerRow[];
    return rows.map(mapTrigger);
  }

  getById(id: string): TriggerRecord | null {
    const row = this.db.prepare(`SELECT * FROM triggers WHERE id = ?`).get(id) as TriggerRow | undefined;
    return row ? mapTrigger(row) : null;
  }

  getByIdForAccount(id: string, accountId: string): TriggerRecord | null {
    const row = this.db
      .prepare(`SELECT * FROM triggers WHERE id = ? AND account_id = ?`)
      .get(id, accountId) as TriggerRow | undefined;
    return row ? mapTrigger(row) : null;
  }

  create(input: {
    accountId: string;
    chain: string;
    network: string;
    draft: TriggerDraft;
    approval: TriggerApprovalLimits;
    schedule?: TriggerTimeSchedule | null;
    maxExecutions: number | null;
    nextCheckAt: string | null;
  }): TriggerRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO triggers (
          id, account_id, chain, network, name, description, type, status,
          condition_json, action_json, approval_json, schedule_json,
          last_checked_at, last_triggered_at, next_check_at,
          execution_count, max_executions, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, NULL, NULL, ?, 0, ?, ?, ?)`,
      )
      .run(
        id,
        input.accountId,
        input.chain,
        input.network,
        input.draft.name,
        input.draft.description,
        input.draft.type,
        JSON.stringify(input.draft.condition),
        JSON.stringify(input.draft.action),
        JSON.stringify(input.approval),
        input.schedule ? JSON.stringify(input.schedule) : null,
        input.nextCheckAt,
        input.maxExecutions,
        now,
        now,
      );
    const created = this.getById(id);
    if (!created) throw new Error("Failed to read trigger after insert");
    return created;
  }

  updateStatus(id: string, accountId: string, status: TriggerStatus): TriggerRecord | null {
    const now = new Date().toISOString();
    this.db
      .prepare(`UPDATE triggers SET status = ?, updated_at = ? WHERE id = ? AND account_id = ?`)
      .run(status, now, id, accountId);
    return this.getByIdForAccount(id, accountId);
  }

  patchScheduleAndChecks(
    id: string,
    patch: {
      lastCheckedAt?: string;
      lastTriggeredAt?: string;
      nextCheckAt?: string | null;
      executionCount?: number;
      status?: TriggerStatus;
    },
  ): void {
    const parts: string[] = ["updated_at = ?"];
    const vals: unknown[] = [new Date().toISOString()];
    if (patch.lastCheckedAt !== undefined) {
      parts.push("last_checked_at = ?");
      vals.push(patch.lastCheckedAt);
    }
    if (patch.lastTriggeredAt !== undefined) {
      parts.push("last_triggered_at = ?");
      vals.push(patch.lastTriggeredAt);
    }
    if (patch.nextCheckAt !== undefined) {
      parts.push("next_check_at = ?");
      vals.push(patch.nextCheckAt);
    }
    if (patch.executionCount !== undefined) {
      parts.push("execution_count = ?");
      vals.push(patch.executionCount);
    }
    if (patch.status !== undefined) {
      parts.push("status = ?");
      vals.push(patch.status);
    }
    vals.push(id);
    this.db
      .prepare(`UPDATE triggers SET ${parts.join(", ")} WHERE id = ?`)
      .run(...(vals as (string | number | null)[]));
  }

  insertExecution(input: {
    triggerId: string;
    accountId: string;
    status: TriggerExecutionStatus;
    conditionSnapshotJson: string;
    actionSnapshotJson: string;
    txDigest?: string | null;
    error?: string | null;
  }): TriggerExecutionRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO trigger_executions (
          id, trigger_id, account_id, status, condition_snapshot_json,
          action_snapshot_json, tx_digest, error, executed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.triggerId,
        input.accountId,
        input.status,
        input.conditionSnapshotJson,
        input.actionSnapshotJson,
        input.txDigest ?? null,
        input.error ?? null,
        now,
      );
    const row = this.db.prepare(`SELECT * FROM trigger_executions WHERE id = ?`).get(id) as ExecutionRow;
    return mapExecution(row);
  }

  listExecutions(triggerId: string, accountId: string, limit = 20): TriggerExecutionRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM trigger_executions
         WHERE trigger_id = ? AND account_id = ?
         ORDER BY executed_at DESC LIMIT ?`,
      )
      .all(triggerId, accountId, limit) as ExecutionRow[];
    return rows.map(mapExecution);
  }
}

export const triggerRepository = new TriggerRepository();
