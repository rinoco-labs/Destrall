import type { DatabaseSync } from "node:sqlite";

/** Safe log fragment — never log full account ids in production-sized strings. */
export function shortAccountId(accountId: string): string {
  const t = accountId.trim();
  if (t.length <= 10) return t;
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

/**
 * Delete contacts scoped to a wallet account (`account_id` match).
 * Global contacts (`account_id IS NULL`) are not removed.
 */
export function clearContactsForAccountDb(db: DatabaseSync, accountId: string): number {
  const id = accountId.trim();
  if (!id) return 0;
  const result = db.prepare(`DELETE FROM contacts WHERE account_id = ?`).run(id);
  return result.changes ?? 0;
}

/** Remove every row in `contacts` (used on full wallet logout / replace). */
export function clearAllContactsDb(db: DatabaseSync): number {
  const result = db.prepare(`DELETE FROM contacts`).run();
  return result.changes ?? 0;
}
