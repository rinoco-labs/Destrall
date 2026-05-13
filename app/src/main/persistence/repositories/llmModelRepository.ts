import type { DatabaseSync } from "node:sqlite";

export type PersistedLlmModelInstall = {
  modelId: string;
  installed: boolean;
  selected: boolean;
  status: "not_installed" | "downloading" | "installed" | "selected" | "failed" | "invalid";
  localPath: string | null;
  fileName: string | null;
  sourceRepo: string;
  sizeBytes: number | null;
  downloadProgress: number | null;
  errorMessage: string | null;
  installedAt: number | null;
  updatedAt: number;
};

type DbRow = Omit<PersistedLlmModelInstall, "installed" | "selected"> & {
  installed: number;
  selected: number;
};

export class LlmModelRepository {
  constructor(private readonly db: DatabaseSync) {}

  list(): PersistedLlmModelInstall[] {
    const rows = this.db
      .prepare(
        `SELECT model_id as modelId, installed, selected, status, local_path as localPath, file_name as fileName,
                source_repo as sourceRepo, size_bytes as sizeBytes, download_progress as downloadProgress,
                error_message as errorMessage, installed_at as installedAt, updated_at as updatedAt
         FROM llm_model_installs`,
      )
      .all() as DbRow[];
    return rows.map((row) => ({
      ...row,
      installed: row.installed === 1,
      selected: row.selected === 1,
    }));
  }

  getByModelId(modelId: string): PersistedLlmModelInstall | null {
    const row = this.db
      .prepare(
        `SELECT model_id as modelId, installed, selected, status, local_path as localPath, file_name as fileName,
                source_repo as sourceRepo, size_bytes as sizeBytes, download_progress as downloadProgress,
                error_message as errorMessage, installed_at as installedAt, updated_at as updatedAt
         FROM llm_model_installs
         WHERE model_id = ?`,
      )
      .get(modelId) as DbRow | undefined;
    if (!row) return null;
    return { ...row, installed: row.installed === 1, selected: row.selected === 1 };
  }

  getSelectedModelId(): string | null {
    const row = this.db
      .prepare(`SELECT model_id as modelId FROM llm_model_installs WHERE selected = 1 LIMIT 1`)
      .get() as { modelId: string } | undefined;
    return row?.modelId ?? null;
  }

  clearSelection(): void {
    this.db
      .prepare(
        `UPDATE llm_model_installs SET selected = 0,
         status = CASE WHEN installed = 1 THEN 'installed' ELSE 'not_installed' END
         WHERE selected = 1`,
      )
      .run();
  }

  upsert(model: PersistedLlmModelInstall): void {
    this.db
      .prepare(
        `INSERT INTO llm_model_installs
         (model_id, installed, selected, status, local_path, file_name, source_repo, size_bytes, download_progress, error_message, installed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(model_id) DO UPDATE SET
         installed = excluded.installed,
         selected = excluded.selected,
         status = excluded.status,
         local_path = excluded.local_path,
         file_name = excluded.file_name,
         source_repo = excluded.source_repo,
         size_bytes = excluded.size_bytes,
         download_progress = excluded.download_progress,
         error_message = excluded.error_message,
         installed_at = excluded.installed_at,
         updated_at = excluded.updated_at`,
      )
      .run(
        model.modelId,
        model.installed ? 1 : 0,
        model.selected ? 1 : 0,
        model.status,
        model.localPath,
        model.fileName,
        model.sourceRepo,
        model.sizeBytes,
        model.downloadProgress,
        model.errorMessage,
        model.installedAt,
        model.updatedAt,
      );
  }

  deleteByModelId(modelId: string): void {
    this.db.prepare(`DELETE FROM llm_model_installs WHERE model_id = ?`).run(modelId);
  }
}
