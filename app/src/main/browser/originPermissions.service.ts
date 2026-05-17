import { randomUUID } from "node:crypto";
import type { BrowserChainId, DappPermission } from "../../browser/types/browser.types";
import { getDatabase } from "../persistence/database";

type OriginRow = {
  id: string;
  account_id: string;
  origin: string;
  chain: string;
  permissions_json: string;
  connected_at: number;
  last_used_at: number;
};

const DEFAULT_CONNECT_PERMISSIONS: DappPermission[] = [
  "viewAccount",
  "signMessage",
  "signTransaction",
  "executeTransaction",
];

class OriginPermissionsService {
  private readonly db = getDatabase();

  isAuthorized(params: {
    accountId: string;
    origin: string;
    chain: BrowserChainId;
    permission: DappPermission;
  }): boolean {
    const row = this.db
      .prepare(
        `SELECT permissions_json FROM dapp_origin_permissions
         WHERE account_id = ? AND origin = ? AND chain = ? LIMIT 1`,
      )
      .get(params.accountId, params.origin, params.chain) as { permissions_json: string } | undefined;
    if (!row) return false;
    try {
      const permissions = JSON.parse(row.permissions_json) as DappPermission[];
      return Array.isArray(permissions) && permissions.includes(params.permission);
    } catch {
      return false;
    }
  }

  getAuthorizedOrigins(accountId: string, chain: BrowserChainId): string[] {
    const rows = this.db
      .prepare(
        `SELECT origin FROM dapp_origin_permissions WHERE account_id = ? AND chain = ? ORDER BY last_used_at DESC`,
      )
      .all(accountId, chain) as { origin: string }[];
    return rows.map((r) => r.origin);
  }

  authorize(params: {
    accountId: string;
    origin: string;
    chain: BrowserChainId;
    permissions?: DappPermission[];
  }) {
    const now = Date.now();
    const permissions = params.permissions ?? DEFAULT_CONNECT_PERMISSIONS;
    this.db
      .prepare(
        `INSERT INTO dapp_origin_permissions (id, account_id, origin, chain, permissions_json, connected_at, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(account_id, origin, chain) DO UPDATE SET
           permissions_json = excluded.permissions_json,
           last_used_at = excluded.last_used_at`,
      )
      .run(
        randomUUID(),
        params.accountId,
        params.origin,
        params.chain,
        JSON.stringify(permissions),
        now,
        now,
      );
  }

  revoke(params: { accountId: string; origin: string; chain: BrowserChainId }) {
    this.db
      .prepare(
        `DELETE FROM dapp_origin_permissions WHERE account_id = ? AND origin = ? AND chain = ?`,
      )
      .run(params.accountId, params.origin, params.chain);
  }

  touchLastUsed(accountId: string, origin: string, chain: BrowserChainId) {
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE dapp_origin_permissions SET last_used_at = ? WHERE account_id = ? AND origin = ? AND chain = ?`,
      )
      .run(now, accountId, origin, chain);
  }

  listForAccount(accountId: string): OriginRow[] {
    return this.db
      .prepare(
        `SELECT id, account_id, origin, chain, permissions_json, connected_at, last_used_at
         FROM dapp_origin_permissions WHERE account_id = ? ORDER BY last_used_at DESC`,
      )
      .all(accountId) as OriginRow[];
  }
}

export const originPermissionsService = new OriginPermissionsService();
