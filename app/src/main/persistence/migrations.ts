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
];

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
}
