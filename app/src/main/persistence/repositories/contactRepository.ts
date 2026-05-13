import { randomUUID } from "node:crypto";
import { getDatabase } from "../database";
import type { ChainId } from "../../../shared/wallet/types";
import { networkSettingsService } from "../../services/network/networkSettingsService";

export type ContactEntity = {
  id: string;
  accountId: string | null;
  name: string;
  address: string;
  chain: ChainId;
  createdAt: number;
  updatedAt: number;
};

type Row = {
  id: string;
  account_id: string | null;
  name: string;
  address: string;
  chain: string;
  created_at: number;
  updated_at: number;
};

function mapRow(row: Row): ContactEntity {
  const chain = row.chain as ChainId;
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    address: row.address,
    chain,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ContactRepository {
  private readonly db = getDatabase();

  /** Avoid FK failures when `contacts.account_id` references `wallet_accounts` but the client sent a stale or unknown id. */
  private resolveValidAccountId(accountId: string | null | undefined): string | null {
    if (accountId == null) return null;
    const id = accountId.trim();
    if (!id) return null;
    const row = this.db.prepare(`SELECT 1 FROM wallet_accounts WHERE id = ?`).get(id);
    return row != null ? id : null;
  }

  private contactsColumnNames(): Set<string> {
    const row = this.db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'contacts'`)
      .get() as { name: string } | undefined;
    if (!row) return new Set();
    const rows = this.db.prepare(`PRAGMA table_info(contacts)`).all() as { name: string }[];
    return new Set(rows.map((r) => r.name));
  }

  list(query?: string): ContactEntity[] {
    const q = query?.trim().toLowerCase();
    if (q) {
      const needle = `%${q}%`;
      const rows = this.db
        .prepare(
          `SELECT * FROM contacts
           WHERE lower(name) LIKE ? OR lower(address) LIKE ?
           ORDER BY updated_at DESC`,
        )
        .all(needle, needle) as Row[];
      return rows.map(mapRow);
    }
    const rows = this.db.prepare(`SELECT * FROM contacts ORDER BY updated_at DESC`).all() as Row[];
    return rows.map(mapRow);
  }

  create(input: {
    name: string;
    address: string;
    chain: ChainId;
    accountId?: string | null;
  }): ContactEntity {
    const id = randomUUID();
    const now = Date.now();
    const cols = this.contactsColumnNames();
    const accountId = this.resolveValidAccountId(input.accountId);

    if (cols.has("network")) {
      const snap = networkSettingsService.getSnapshot();
      const networkVal =
        input.chain === "sui" ? `${input.chain}:${snap.activeEnvironment}` : input.chain;
      this.db
        .prepare(
          `INSERT INTO contacts (id, account_id, name, address, chain, network, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          accountId,
          input.name,
          input.address,
          input.chain,
          networkVal,
          now,
          now,
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO contacts (id, account_id, name, address, chain, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id, accountId, input.name, input.address, input.chain, now, now);
    }

    const created = this.getById(id);
    if (!created) {
      throw new Error("Failed to read contact after insert");
    }
    return created;
  }

  update(input: { id: string; name: string; address: string }): ContactEntity {
    const now = Date.now();
    this.db
      .prepare(`UPDATE contacts SET name = ?, address = ?, updated_at = ? WHERE id = ?`)
      .run(input.name, input.address, now, input.id);
    const updated = this.getById(input.id);
    if (!updated) {
      throw new Error("Contact not found after update");
    }
    return updated;
  }

  delete(id: string) {
    this.db.prepare(`DELETE FROM contacts WHERE id = ?`).run(id);
  }

  getById(id: string): ContactEntity | null {
    const row = this.db.prepare(`SELECT * FROM contacts WHERE id = ?`).get(id) as Row | undefined;
    return row ? mapRow(row) : null;
  }
}

export const contactRepository = new ContactRepository();
