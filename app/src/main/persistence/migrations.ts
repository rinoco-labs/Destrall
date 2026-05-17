import type { DatabaseSync } from "node:sqlite";

type Migration = {
  version: number;
  name: string;
  up: (db: DatabaseSync) => void;
};

const migrations: Migration[] = [
  {
    version: 1,
    name: "wallet_core",
    up: (db) => {
      ensureWalletTables(db);
    },
  },
  {
    version: 2,
    name: "llm_model_installs",
    up: (db) => {
      ensureLlmModelTables(db);
    },
  },
  {
    version: 3,
    name: "assistant_chats",
    up: (db) => {
      ensureAssistantChatTables(db);
    },
  },
  {
    version: 4,
    name: "contacts",
    up: (db) => {
      ensureContactsTable(db);
    },
  },
  {
    version: 5,
    name: "triggers",
    up: (db) => {
      ensureTriggerTables(db);
    },
  },
  {
    version: 6,
    name: "browser_dapp",
    up: (db) => {
      ensureBrowserTables(db);
    },
  },
  {
    version: 7,
    name: "browser_strip_legacy_fk",
    up: (db) => {
      stripBrowserTablesForeignKeys(db);
    },
  },
  {
    version: 8,
    name: "browser_favorites",
    up: (db) => {
      ensureBrowserFavoritesTable(db);
    },
  },
];

export function ensureAssistantChatTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_chats (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      title TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_message_at TEXT
    ) STRICT;
    CREATE TABLE IF NOT EXISTS assistant_messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES assistant_chats(id) ON DELETE CASCADE
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_assistant_chats_account_id ON assistant_chats(account_id);
    CREATE INDEX IF NOT EXISTS idx_assistant_chats_account_pinned ON assistant_chats(account_id, pinned);
    CREATE INDEX IF NOT EXISTS idx_assistant_chats_account_last_msg ON assistant_chats(account_id, last_message_at);
    CREATE INDEX IF NOT EXISTS idx_assistant_messages_chat_id ON assistant_messages(chat_id);
    CREATE INDEX IF NOT EXISTS idx_assistant_messages_account_id ON assistant_messages(account_id);
  `);
}

export function ensureLlmModelTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS llm_model_installs (
      model_id TEXT PRIMARY KEY,
      installed INTEGER NOT NULL,
      selected INTEGER NOT NULL,
      status TEXT NOT NULL,
      local_path TEXT,
      file_name TEXT,
      source_repo TEXT NOT NULL,
      size_bytes INTEGER,
      download_progress INTEGER,
      error_message TEXT,
      installed_at INTEGER,
      updated_at INTEGER NOT NULL
    ) STRICT;
  `);
}

function contactsColumnNames(db: DatabaseSync): Set<string> {
  if (!tableExists(db, "contacts")) {
    return new Set();
  }
  const rows = db.prepare(`PRAGMA table_info(contacts)`).all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

function contactsHasForeignKeys(db: DatabaseSync): boolean {
  if (!tableExists(db, "contacts")) return false;
  const rows = db.prepare(`PRAGMA foreign_key_list(contacts)`).all() as unknown[];
  return rows.length > 0;
}

/**
 * Legacy or fork DBs may define `FOREIGN KEY (account_id) REFERENCES wallet_accounts(id)`.
 * Destrall treats `account_id` as optional metadata; invalid ids must not block inserts.
 * Rebuild `contacts` without FK constraints while preserving rows (invalid account_id → NULL).
 */
function stripContactsTableForeignKeys(db: DatabaseSync) {
  if (!contactsHasForeignKeys(db)) return;

  console.warn(
    "[migrations] Rebuilding contacts without foreign keys (legacy schema used REFERENCES wallet_accounts).",
  );

  const cols = contactsColumnNames(db);
  const rows = db.prepare(`SELECT * FROM contacts`).all() as Record<string, unknown>[];
  const walletAccountsExist = tableExists(db, "wallet_accounts");
  const accOk = walletAccountsExist
    ? db.prepare(`SELECT 1 FROM wallet_accounts WHERE id = ?`)
    : null;

  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`DROP TABLE IF EXISTS contacts__fkstrip`);
    db.exec(`
      CREATE TABLE contacts__fkstrip (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        chain TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
    `);
    const insert = db.prepare(`
      INSERT INTO contacts__fkstrip (id, account_id, name, address, chain, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const r of rows) {
      const id = String(r.id ?? "");
      const name = String(r.name ?? "");
      const address = String(r.address ?? "");
      if (!id || !name || !address) continue;

      let chain = "sui";
      const rawChain = r.chain;
      if (typeof rawChain === "string" && rawChain.trim()) {
        const t = rawChain.trim();
        if (t === "sui" || t === "solana" || t === "evm") chain = t;
      } else if (cols.has("network") && typeof r.network === "string") {
        const n = r.network.toLowerCase();
        if (n.includes("solana")) chain = "solana";
        else if (n.includes("evm") || n.includes("eth")) chain = "evm";
      }

      let accountId: string | null = null;
      const rawAcc = r.account_id;
      if (typeof rawAcc === "string" && rawAcc.trim() && accOk) {
        const aid = rawAcc.trim();
        if (accOk.get(aid) != null) accountId = aid;
      }

      const createdAt =
        typeof r.created_at === "number" && Number.isFinite(r.created_at)
          ? r.created_at
          : Number(r.created_at) || Date.now();
      const updatedAt =
        typeof r.updated_at === "number" && Number.isFinite(r.updated_at)
          ? r.updated_at
          : Number(r.updated_at) || createdAt;

      insert.run(id, accountId, name, address, chain, createdAt, updatedAt);
    }

    db.exec(`DROP TABLE contacts`);
    db.exec(`ALTER TABLE contacts__fkstrip RENAME TO contacts`);
    db.exec("COMMIT");
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  }
}

/** Create contacts table and indexes; upgrade legacy schemas (missing `chain`, or orphan `network`). */
export function ensureContactsTable(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      account_id TEXT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      chain TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
  `);

  let cols = contactsColumnNames(db);
  if (cols.size > 0 && !cols.has("chain")) {
    db.exec(`ALTER TABLE contacts ADD COLUMN chain TEXT NOT NULL DEFAULT 'sui'`);
    cols = contactsColumnNames(db);
  }

  if (cols.has("network")) {
    if (!cols.has("chain")) {
      db.exec(`ALTER TABLE contacts ADD COLUMN chain TEXT NOT NULL DEFAULT 'sui'`);
      cols = contactsColumnNames(db);
    }
    db.exec(`
      UPDATE contacts SET chain = CASE
        WHEN lower(COALESCE(network, '')) LIKE '%solana%' THEN 'solana'
        WHEN lower(COALESCE(network, '')) LIKE '%evm%'
          OR lower(COALESCE(network, '')) LIKE '%eth%' THEN 'evm'
        WHEN trim(COALESCE(chain, '')) != '' THEN chain
        ELSE 'sui'
      END
    `);
    try {
      db.exec(`ALTER TABLE contacts DROP COLUMN network`);
    } catch {
      console.warn(
        "[migrations] Could not DROP COLUMN contacts.network; add a default or recreate DB if inserts still fail.",
      );
    }
  }

  stripContactsTableForeignKeys(db);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_contacts_chain ON contacts (chain);
    CREATE INDEX IF NOT EXISTS idx_contacts_address ON contacts (address);
    CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts (name);
  `);
}

export function ensureWalletTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallet_profile (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS wallet_accounts (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      chain TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      public_key TEXT NOT NULL,
      account_index INTEGER NOT NULL,
      derivation_path TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES wallet_profile(id) ON DELETE CASCADE,
      UNIQUE (profile_id, chain, account_index)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_wallet_accounts_profile_id ON wallet_accounts(profile_id);
    CREATE INDEX IF NOT EXISTS idx_wallet_accounts_chain ON wallet_accounts(chain);
  `);
}

function tableExists(db: DatabaseSync, table: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(table) as { name: string } | undefined;
  return row != null;
}

export function runMigrations(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    ) STRICT;
  `);

  const hasMigration = db.prepare(`SELECT version FROM schema_migrations WHERE version = ?`);
  const insertMigration = db.prepare(
    `INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)`,
  );

  for (const migration of migrations) {
    const applied = hasMigration.get(migration.version);
    const needsRepair =
      migration.version === 1 && !tableExists(db, "wallet_accounts");
    if (!applied || needsRepair) {
      migration.up(db);
      if (!applied) {
        insertMigration.run(migration.version, migration.name, Date.now());
      }
    }
  }

  ensureWalletTables(db);
  ensureLlmModelTables(db);
  ensureAssistantChatTables(db);
  ensureContactsTable(db);
  ensureTriggerTables(db);
  ensureBrowserTables(db);
}

function tableHasForeignKeys(db: DatabaseSync, table: string): boolean {
  if (!tableExists(db, table)) return false;
  const rows = db.prepare(`PRAGMA foreign_key_list(${table})`).all() as unknown[];
  return rows.length > 0;
}

/**
 * App-copy / fork DBs may reference `wallets(id)` while Destrall uses `wallet_accounts(id)`.
 * Rebuild browser tables without FK constraints so dapp connect approval can persist state.
 */
export function stripBrowserTablesForeignKeys(db: DatabaseSync) {
  const browserTables = ["browser_tabs", "browser_history", "connected_dapps"];
  if (!browserTables.some((name) => tableHasForeignKeys(db, name))) return;

  console.warn(
    "[migrations] Rebuilding browser tables without foreign keys (legacy app-copy schema used REFERENCES wallets).",
  );

  db.exec("BEGIN IMMEDIATE");
  try {
    if (tableHasForeignKeys(db, "browser_tabs") && tableExists(db, "browser_tabs")) {
      const rows = db.prepare(`SELECT * FROM browser_tabs`).all() as Record<string, unknown>[];
      db.exec(`DROP TABLE IF EXISTS browser_tabs__fkstrip`);
      db.exec(`
        CREATE TABLE browser_tabs__fkstrip (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          url TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          favicon TEXT NOT NULL DEFAULT '',
          nav_history_json TEXT NOT NULL DEFAULT '[]',
          nav_index INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        ) STRICT;
      `);
      const insert = db.prepare(`
        INSERT INTO browser_tabs__fkstrip
        (id, account_id, url, title, favicon, nav_history_json, nav_index, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of rows) {
        insert.run(
          String(r.id ?? ""),
          String(r.account_id ?? ""),
          String(r.url ?? ""),
          String(r.title ?? ""),
          String(r.favicon ?? ""),
          String(r.nav_history_json ?? "[]"),
          Number(r.nav_index) || 0,
          Number(r.created_at) || Date.now(),
          Number(r.updated_at) || Date.now(),
        );
      }
      db.exec(`DROP TABLE browser_tabs`);
      db.exec(`ALTER TABLE browser_tabs__fkstrip RENAME TO browser_tabs`);
    }

    if (tableHasForeignKeys(db, "browser_history") && tableExists(db, "browser_history")) {
      const rows = db.prepare(`SELECT * FROM browser_history`).all() as Record<string, unknown>[];
      db.exec(`DROP TABLE IF EXISTS browser_history__fkstrip`);
      db.exec(`
        CREATE TABLE browser_history__fkstrip (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          url TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          domain TEXT NOT NULL DEFAULT '',
          timestamp INTEGER NOT NULL
        ) STRICT;
      `);
      const insert = db.prepare(`
        INSERT INTO browser_history__fkstrip (id, account_id, url, title, domain, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const r of rows) {
        insert.run(
          String(r.id ?? ""),
          String(r.account_id ?? ""),
          String(r.url ?? ""),
          String(r.title ?? ""),
          String(r.domain ?? ""),
          Number(r.timestamp) || Date.now(),
        );
      }
      db.exec(`DROP TABLE browser_history`);
      db.exec(`ALTER TABLE browser_history__fkstrip RENAME TO browser_history`);
    }

    if (tableHasForeignKeys(db, "connected_dapps") && tableExists(db, "connected_dapps")) {
      const rows = db.prepare(`SELECT * FROM connected_dapps`).all() as Record<string, unknown>[];
      db.exec(`DROP TABLE IF EXISTS connected_dapps__fkstrip`);
      db.exec(`
        CREATE TABLE connected_dapps__fkstrip (
          account_id TEXT NOT NULL,
          origin TEXT NOT NULL,
          display_name TEXT NOT NULL DEFAULT '',
          favicon TEXT NOT NULL DEFAULT '',
          accounts_json TEXT NOT NULL DEFAULT '[]',
          network TEXT NOT NULL DEFAULT '',
          permissions_json TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'connected',
          first_connected INTEGER NOT NULL,
          last_used INTEGER NOT NULL,
          PRIMARY KEY (account_id, origin)
        ) STRICT;
      `);
      const insert = db.prepare(`
        INSERT INTO connected_dapps__fkstrip
        (account_id, origin, display_name, favicon, accounts_json, network, permissions_json, status, first_connected, last_used)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of rows) {
        insert.run(
          String(r.account_id ?? ""),
          String(r.origin ?? ""),
          String(r.display_name ?? ""),
          String(r.favicon ?? ""),
          String(r.accounts_json ?? "[]"),
          String(r.network ?? ""),
          String(r.permissions_json ?? "[]"),
          String(r.status ?? "connected"),
          Number(r.first_connected) || Date.now(),
          Number(r.last_used) || Date.now(),
        );
      }
      db.exec(`DROP TABLE connected_dapps`);
      db.exec(`ALTER TABLE connected_dapps__fkstrip RENAME TO connected_dapps`);
    }

    db.exec("COMMIT");
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  }
}

export function ensureBrowserTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS browser_tabs (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      favicon TEXT NOT NULL DEFAULT '',
      nav_history_json TEXT NOT NULL DEFAULT '[]',
      nav_index INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS browser_history (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      domain TEXT NOT NULL DEFAULT '',
      timestamp INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS connected_dapps (
      account_id TEXT NOT NULL,
      origin TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      favicon TEXT NOT NULL DEFAULT '',
      accounts_json TEXT NOT NULL DEFAULT '[]',
      network TEXT NOT NULL DEFAULT '',
      permissions_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'connected',
      first_connected INTEGER NOT NULL,
      last_used INTEGER NOT NULL,
      PRIMARY KEY (account_id, origin)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS dapp_origin_permissions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      origin TEXT NOT NULL,
      chain TEXT NOT NULL,
      permissions_json TEXT NOT NULL,
      connected_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL,
      UNIQUE(account_id, origin, chain)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_browser_tabs_account_id ON browser_tabs(account_id);
    CREATE INDEX IF NOT EXISTS idx_browser_history_account_id ON browser_history(account_id);
    CREATE INDEX IF NOT EXISTS idx_dapp_origin_permissions_account ON dapp_origin_permissions(account_id);
  `);
  ensureBrowserFavoritesTable(db);
  stripBrowserTablesForeignKeys(db);
}

export function ensureBrowserFavoritesTable(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS browser_favorites (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      dapp_id TEXT,
      url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      pinned INTEGER NOT NULL DEFAULT 0,
      added_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_browser_favorites_account_id ON browser_favorites(account_id);
  `);
}

export function ensureTriggerTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS triggers (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      chain TEXT NOT NULL,
      network TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      condition_json TEXT NOT NULL,
      action_json TEXT NOT NULL,
      approval_json TEXT NOT NULL,
      schedule_json TEXT,
      last_checked_at TEXT,
      last_triggered_at TEXT,
      next_check_at TEXT,
      execution_count INTEGER NOT NULL DEFAULT 0,
      max_executions INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS trigger_executions (
      id TEXT PRIMARY KEY,
      trigger_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      status TEXT NOT NULL,
      condition_snapshot_json TEXT NOT NULL,
      action_snapshot_json TEXT NOT NULL,
      tx_digest TEXT,
      error TEXT,
      executed_at TEXT NOT NULL,
      FOREIGN KEY (trigger_id) REFERENCES triggers(id) ON DELETE CASCADE
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_triggers_account_id ON triggers(account_id);
    CREATE INDEX IF NOT EXISTS idx_triggers_status ON triggers(status);
    CREATE INDEX IF NOT EXISTS idx_triggers_next_check_at ON triggers(next_check_at);
    CREATE INDEX IF NOT EXISTS idx_trigger_executions_trigger_id ON trigger_executions(trigger_id);
    CREATE INDEX IF NOT EXISTS idx_trigger_executions_account_id ON trigger_executions(account_id);
  `);
}
