import { randomUUID } from "node:crypto";
import type { BrowserPersistedState, ConnectedDappRecord } from "../../browser/types/browser.types";
import { EMPTY_BROWSER_STATE } from "../../browser/types/browser.types";
import { getDatabase, runInTransaction } from "../persistence/database";

class BrowserStateRepository {
  private readonly db = getDatabase();

  private assertAccountExists(accountId: string) {
    const row = this.db.prepare(`SELECT 1 FROM wallet_accounts WHERE id = ?`).get(accountId);
    if (!row) {
      throw new Error(`Wallet account not found: ${accountId}`);
    }
  }

  getByAccount(accountId: string): BrowserPersistedState {
    const tabs = this.db
      .prepare(
        `SELECT id, url, title, favicon, nav_history_json, nav_index
         FROM browser_tabs WHERE account_id = ? ORDER BY updated_at ASC`,
      )
      .all(accountId) as {
      id: string;
      url: string;
      title: string;
      favicon: string;
      nav_history_json: string;
      nav_index: number;
    }[];

    const history = this.db
      .prepare(
        `SELECT id, url, title, domain, timestamp FROM browser_history
         WHERE account_id = ? ORDER BY timestamp DESC LIMIT 200`,
      )
      .all(accountId) as {
      id: string;
      url: string;
      title: string;
      domain: string;
      timestamp: number;
    }[];

    const dapps = this.db
      .prepare(
        `SELECT origin, display_name, favicon, accounts_json, network, permissions_json, status, first_connected, last_used
         FROM connected_dapps WHERE account_id = ? ORDER BY last_used DESC`,
      )
      .all(accountId) as {
      origin: string;
      display_name: string;
      favicon: string;
      accounts_json: string;
      network: string;
      permissions_json: string;
      status: string;
      first_connected: number;
      last_used: number;
    }[];

    const activeRow = this.db
      .prepare(`SELECT value FROM app_settings WHERE key = ?`)
      .get(`browser_active_tab:${accountId}`) as { value: string } | undefined;

    const connectedDapps: ConnectedDappRecord[] = dapps.map((d) => ({
      origin: d.origin,
      displayName: d.display_name,
      favicon: d.favicon,
      accounts: this.parseStringArray(d.accounts_json),
      network: d.network,
      permissions: this.parseStringArray(d.permissions_json) as ConnectedDappRecord["permissions"],
      status: d.status === "disconnected" ? "disconnected" : "connected",
      firstConnected: d.first_connected,
      lastUsed: d.last_used,
    }));

    return {
      tabs: tabs.map((t) => ({
        id: t.id,
        url: t.url,
        title: t.title,
        favicon: t.favicon,
        navHistory: this.parseStringArray(t.nav_history_json),
        navIndex: t.nav_index,
      })),
      activeTabId: activeRow?.value ?? tabs[0]?.id ?? "",
      history: history.map((h) => ({
        id: h.id,
        url: h.url,
        title: h.title,
        domain: h.domain,
        timestamp: h.timestamp,
      })),
      connectedDapps,
    };
  }

  replaceForAccount(accountId: string, state: BrowserPersistedState): BrowserPersistedState {
    this.assertAccountExists(accountId);
    runInTransaction(this.db, () => {
      this.db.prepare(`DELETE FROM browser_tabs WHERE account_id = ?`).run(accountId);
      this.db.prepare(`DELETE FROM browser_history WHERE account_id = ?`).run(accountId);
      this.db.prepare(`DELETE FROM connected_dapps WHERE account_id = ?`).run(accountId);

      const now = Date.now();
      for (const tab of state.tabs) {
        this.db
          .prepare(
            `INSERT INTO browser_tabs (id, account_id, url, title, favicon, nav_history_json, nav_index, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            tab.id,
            accountId,
            tab.url,
            tab.title,
            tab.favicon,
            JSON.stringify(tab.navHistory),
            tab.navIndex,
            now,
            now,
          );
      }

      for (const item of state.history) {
        this.db
          .prepare(
            `INSERT INTO browser_history (id, account_id, url, title, domain, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(item.id, accountId, item.url, item.title, item.domain, item.timestamp);
      }

      for (const dapp of state.connectedDapps) {
        this.db
          .prepare(
            `INSERT INTO connected_dapps
             (account_id, origin, display_name, favicon, accounts_json, network, permissions_json, status, first_connected, last_used)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            accountId,
            dapp.origin,
            dapp.displayName,
            dapp.favicon,
            JSON.stringify(dapp.accounts),
            dapp.network,
            JSON.stringify(dapp.permissions),
            dapp.status,
            dapp.firstConnected,
            dapp.lastUsed,
          );
      }

      const activeKey = `browser_active_tab:${accountId}`;
      const activeId = state.activeTabId || "";
      this.db
        .prepare(
          `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        )
        .run(activeKey, activeId, now);
    });
    return state;
  }

  authorizeDapp(args: {
    accountId: string;
    origin: string;
    displayName: string;
    accountAddress: string;
    network: string;
    permissions: ConnectedDappRecord["permissions"];
  }) {
    const current = this.getByAccount(args.accountId);
    const now = Date.now();
    const connectedDapps = current.connectedDapps.filter((d) => d.origin !== args.origin);
    connectedDapps.unshift({
      origin: args.origin,
      displayName: args.displayName,
      favicon: "",
      accounts: [args.accountAddress],
      network: args.network,
      permissions: args.permissions,
      status: "connected",
      firstConnected: now,
      lastUsed: now,
    });
    return this.replaceForAccount(args.accountId, { ...current, connectedDapps });
  }

  private parseStringArray(value: string): string[] {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    } catch {
      return [];
    }
  }
}

export const browserStateRepository = new BrowserStateRepository();

export function emptyBrowserState(): BrowserPersistedState {
  return { ...EMPTY_BROWSER_STATE };
}
