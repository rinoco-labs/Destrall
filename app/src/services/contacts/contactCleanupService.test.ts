import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { ensureContactsTable } from "../../main/persistence/migrations.ts";
import { resolveRecipientLabel } from "./contactResolutionService.ts";
import { clearAllContactsDb, clearContactsForAccountDb } from "./contactCleanupDb.ts";

function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  ensureContactsTable(db);
  return db;
}

function insertContact(
  db: DatabaseSync,
  row: { id: string; accountId: string | null; name: string; address: string },
) {
  const now = Date.now();
  db.prepare(
    `INSERT INTO contacts (id, account_id, name, address, chain, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'sui', ?, ?)`,
  ).run(row.id, row.accountId, row.name, row.address, now, now);
}

function listContactNames(db: DatabaseSync): string[] {
  const rows = db.prepare(`SELECT name FROM contacts ORDER BY name`).all() as { name: string }[];
  return rows.map((r) => r.name);
}

describe("contact cleanup on logout", () => {
  it("removes all contacts from sqlite (simulated logout)", () => {
    const db = createTestDb();
    insertContact(db, {
      id: randomUUID(),
      accountId: "acc-a",
      name: "John",
      address: "0x" + "a".repeat(64),
    });
    assert.equal(listContactNames(db).length, 1);

    const removed = clearAllContactsDb(db);
    assert.equal(removed, 1);
    assert.deepEqual(listContactNames(db), []);
  });
});

describe("contact cleanup per account (wallet delete)", () => {
  it("removes only contacts for the deleted account", () => {
    const db = createTestDb();
    const accountA = "acc-a";
    const accountB = "acc-b";
    insertContact(db, {
      id: randomUUID(),
      accountId: accountA,
      name: "John",
      address: "0x" + "a".repeat(64),
    });
    insertContact(db, {
      id: randomUUID(),
      accountId: accountB,
      name: "Maria",
      address: "0x" + "b".repeat(64),
    });
    insertContact(db, {
      id: randomUUID(),
      accountId: null,
      name: "Global",
      address: "0x" + "c".repeat(64),
    });

    clearContactsForAccountDb(db, accountA);
    assert.deepEqual(listContactNames(db), ["Global", "Maria"]);
  });
});

describe("account isolation", () => {
  it("account B list excludes account A scoped contact after scoped delete", () => {
    const db = createTestDb();
    const accountA = "acc-a";
    const accountB = "acc-b";
    insertContact(db, {
      id: randomUUID(),
      accountId: accountA,
      name: "John",
      address: "0x" + "a".repeat(64),
    });
    insertContact(db, {
      id: randomUUID(),
      accountId: accountB,
      name: "Other",
      address: "0x" + "b".repeat(64),
    });

    const namesForB = (activeId: string) => {
      const rows = db
        .prepare(`SELECT name, account_id FROM contacts`)
        .all() as { name: string; account_id: string | null }[];
      return rows
        .filter((r) => r.account_id == null || r.account_id === activeId)
        .map((r) => r.name);
    };

    assert.ok(namesForB(accountB).includes("Other"));
    assert.ok(!namesForB(accountB).includes("John"));

    clearContactsForAccountDb(db, accountA);
    assert.deepEqual(namesForB(accountB), ["Other"]);
    assert.ok(!namesForB(accountB).includes("John"));
  });
});

describe("assistant recipient resolution after logout", () => {
  it("does not resolve John from stale contacts after clear", () => {
    const db = createTestDb();
    insertContact(db, {
      id: randomUUID(),
      accountId: "acc-a",
      name: "John",
      address: "0x" + "a".repeat(64),
    });

    const contactsBefore = db
      .prepare(`SELECT id, name, address FROM contacts`)
      .all() as { id: string; name: string; address: string }[];

    const before = resolveRecipientLabel({ recipient: "John", contacts: contactsBefore });
    assert.equal(before.kind, "single_contact");

    clearAllContactsDb(db);
    const contactsAfter = db
      .prepare(`SELECT id, name, address FROM contacts`)
      .all() as { id: string; name: string; address: string }[];

    const after = resolveRecipientLabel({ recipient: "John", contacts: contactsAfter });
    assert.equal(after.kind, "none");
  });
});

describe("rehydration", () => {
  it("contacts do not return after clear and re-read", () => {
    const db = createTestDb();
    insertContact(db, {
      id: randomUUID(),
      accountId: "acc-a",
      name: "John",
      address: "0x" + "a".repeat(64),
    });
    clearAllContactsDb(db);

    const db2 = db;
    assert.deepEqual(listContactNames(db2), []);
  });
});
