import path from "node:path";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { app } from "electron";
import { runMigrations } from "./migrations";

let dbInstance: DatabaseSync | null = null;

function resolveStoragePath(): string {
  const homeDir = app.getPath("home");
  const rootDir = path.join(homeDir, ".destrall");
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
  }
  return path.join(rootDir, "destrall.sqlite");
}

export function getDatabase(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const filePath = resolveStoragePath();
  const db = new DatabaseSync(filePath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  runMigrations(db);
  dbInstance = db;
  return db;
}

export function closeDatabase() {
  if (!dbInstance) return;
  dbInstance.close();
  dbInstance = null;
}

export function runInTransaction(db: DatabaseSync, fn: () => void) {
  db.exec("BEGIN IMMEDIATE");
  try {
    fn();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
