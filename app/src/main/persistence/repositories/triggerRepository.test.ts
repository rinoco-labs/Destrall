import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { ensureTriggerTables } from "../migrations.ts";

function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  ensureTriggerTables(db);
  return db;
}

function insertTrigger(
  db: DatabaseSync,
  row: {
    id: string;
    accountId: string;
    name: string;
    status?: string;
    nextCheckAt?: string | null;
  },
) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO triggers (
      id, account_id, chain, network, name, description, type, status,
      condition_json, action_json, approval_json, schedule_json,
      last_checked_at, last_triggered_at, next_check_at,
      execution_count, max_executions, created_at, updated_at
    ) VALUES (?, ?, 'sui', 'mainnet', ?, '', 'price', ?, '{}', '{}', '{}', NULL, NULL, NULL, ?, 0, NULL, ?, ?)`,
  ).run(
    row.id,
    row.accountId,
    row.name,
    row.status ?? "active",
    row.nextCheckAt ?? now,
    now,
    now,
  );
}

function listByAccount(db: DatabaseSync, accountId: string): { id: string; name: string; status: string }[] {
  return db
    .prepare(
      `SELECT id, name, status FROM triggers WHERE account_id = ? AND status != 'deleted' ORDER BY created_at DESC`,
    )
    .all(accountId) as { id: string; name: string; status: string }[];
}

function updateStatus(
  db: DatabaseSync,
  id: string,
  accountId: string,
  status: string,
): void {
  db.prepare(`UPDATE triggers SET status = ?, updated_at = ? WHERE id = ? AND account_id = ?`).run(
    status,
    new Date().toISOString(),
    id,
    accountId,
  );
}

function listDueActive(db: DatabaseSync, nowIso: string, accountId: string): { id: string }[] {
  return db
    .prepare(
      `SELECT id FROM triggers
       WHERE account_id = ? AND status = 'active' AND (next_check_at IS NULL OR next_check_at <= ?)`,
    )
    .all(accountId, nowIso) as { id: string }[];
}

describe("triggers persistence (settings list source of truth)", () => {
  it("lists triggers for the active account only", () => {
    const db = createTestDb();
    insertTrigger(db, { id: randomUUID(), accountId: "acc-a", name: "A" });
    insertTrigger(db, { id: randomUUID(), accountId: "acc-b", name: "B" });
    assert.equal(listByAccount(db, "acc-a").length, 1);
    assert.equal(listByAccount(db, "acc-b")[0]?.name, "B");
  });

  it("shows empty state when account has no triggers", () => {
    const db = createTestDb();
    insertTrigger(db, { id: randomUUID(), accountId: "acc-a", name: "A" });
    assert.deepEqual(listByAccount(db, "acc-b"), []);
  });

  it("pause updates status and runner due query skips paused triggers", () => {
    const db = createTestDb();
    const id = randomUUID();
    insertTrigger(db, { id, accountId: "acc-a", name: "Pausable" });
    updateStatus(db, id, "acc-a", "paused");
    assert.equal(listByAccount(db, "acc-a")[0]?.status, "paused");
    const future = new Date(Date.now() + 86_400_000).toISOString();
    assert.equal(listDueActive(db, future, "acc-a").length, 0);
  });

  it("resume sets status to active and includes trigger in due query", () => {
    const db = createTestDb();
    const id = randomUUID();
    const past = new Date(Date.now() - 1000).toISOString();
    insertTrigger(db, { id, accountId: "acc-a", name: "Resumable", nextCheckAt: past });
    updateStatus(db, id, "acc-a", "paused");
    updateStatus(db, id, "acc-a", "active");
    assert.equal(listDueActive(db, new Date().toISOString(), "acc-a").length, 1);
  });

  it("delete removes trigger from list and due query", () => {
    const db = createTestDb();
    const id = randomUUID();
    insertTrigger(db, { id, accountId: "acc-a", name: "Removable" });
    updateStatus(db, id, "acc-a", "deleted");
    assert.equal(listByAccount(db, "acc-a").length, 0);
    assert.equal(listDueActive(db, new Date().toISOString(), "acc-a").length, 0);
  });

  it("does not update status when account id does not match", () => {
    const db = createTestDb();
    const id = randomUUID();
    insertTrigger(db, { id, accountId: "acc-a", name: "Scoped" });
    updateStatus(db, id, "acc-b", "paused");
    assert.equal(listByAccount(db, "acc-a")[0]?.status, "active");
  });
});
