import fs from "node:fs";
import path from "node:path";
import type { WebContents } from "electron";
import { INTERNAL_AI_MODEL } from "../../ai/internalModelConfig";
import {
  IPCChannels,
  type AssistantAiModelState,
  type AssistantRuntimeState,
  type LlmInstallStatus,
  type LlmStateSnapshot,
  type ModelProgressEvent,
} from "../../shared/ipc";
import { getDatabase } from "../persistence/database";
import { LlmModelRepository, type PersistedLlmModelInstall } from "../persistence/repositories/llmModelRepository";
import { buildAssistantStructuredBlocks } from "../services/assistant/assistantStructuredOrchestrator";
import { buildAssistantContextDocument } from "../../assistant/assistantContextBuilder";
import { assistantInferenceService, type ChatTurnMessage } from "./assistantInferenceService";
import { modelDownloadService } from "./modelDownloadService";
import { modelRuntimeService } from "./modelRuntimeService";
import { modelStorageService } from "./modelStorageService";

function now() {
  return Date.now();
}

const INTERNAL_ID = INTERNAL_AI_MODEL.id;
/** Pre-v1 multi-model catalog row ids (SQLite migration only). */
const LEGACY_CATALOG_MODEL_ID_V0_PRIMARY = "qwen2.5-3b-instruct-q4-k-m";
const LEGACY_CATALOG_MODEL_ID_V0_ALT = "gemma-4-e2b-it-q4-0";

export class AiModelMainService {
  private readonly repo: LlmModelRepository;
  private startupRestoreAttempted = false;
  private tail: Promise<unknown> = Promise.resolve();
  private downloadAbort: AbortController | null = null;
  private legacyMigrationDone = false;

  constructor() {
    this.repo = new LlmModelRepository(getDatabase());
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run: Promise<T> = this.tail.then(() => fn());
    this.tail = run.finally(() => undefined);
    return run;
  }

  private emitProgress(webContents: WebContents | undefined, evt: ModelProgressEvent) {
    try {
      webContents?.send(IPCChannels.llmModelProgress, evt);
    } catch {
      /* window may be destroyed */
    }
  }

  /** One-time: remove obsolete catalog rows and fold the former primary row into `assistant-model`. */
  private migrateLegacyPersistence(): void {
    if (this.legacyMigrationDone) return;
    this.legacyMigrationDone = true;

    this.repo.deleteByModelId(LEGACY_CATALOG_MODEL_ID_V0_ALT);

    const legacyPrimary = this.repo.getByModelId(LEGACY_CATALOG_MODEL_ID_V0_PRIMARY);
    const internal = this.repo.getByModelId(INTERNAL_ID);

    if (legacyPrimary) {
      const pathOk = legacyPrimary.localPath && fs.existsSync(legacyPrimary.localPath);
      if (pathOk && legacyPrimary.localPath) {
        const base: Omit<PersistedLlmModelInstall, "modelId"> = {
          installed: true,
          selected: legacyPrimary.selected || internal?.selected || false,
          status:
            legacyPrimary.status === "selected" || internal?.status === "selected" ? "selected" : "installed",
          localPath: legacyPrimary.localPath,
          fileName: legacyPrimary.fileName ?? path.basename(legacyPrimary.localPath),
          sourceRepo: INTERNAL_AI_MODEL.repo,
          sizeBytes: legacyPrimary.sizeBytes ?? INTERNAL_AI_MODEL.sizeBytes ?? null,
          downloadProgress: 100,
          errorMessage: null,
          installedAt: legacyPrimary.installedAt ?? internal?.installedAt ?? now(),
          updatedAt: now(),
        };
        this.repo.upsert({ modelId: INTERNAL_ID, ...base });
      }
      this.repo.deleteByModelId(LEGACY_CATALOG_MODEL_ID_V0_PRIMARY);
    }

    const modelsDir = modelStorageService.getModelDirectory();
    for (const name of ["gemma-4-e2b-it-q4_0.gguf", "gemma-4-e2b-it-Q4_0.gguf"]) {
      const p = path.join(modelsDir, name);
      try {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          fs.unlinkSync(p);
        }
      } catch {
        /* ignore */
      }
    }

    for (const row of this.repo.list()) {
      if (row.modelId !== INTERNAL_ID) {
        this.repo.deleteByModelId(row.modelId);
      }
    }
  }

  getAssistantRuntimeState(): AssistantRuntimeState {
    return {
      status: modelRuntimeService.getStatus(),
      errorMessage: modelRuntimeService.getError(),
    };
  }

  private buildDiskView(): AssistantAiModelState {
    this.migrateLegacyPersistence();
    const row = this.repo.getByModelId(INTERNAL_ID);
    const diskPath = modelStorageService.resolveExistingPath();
    const persistedPath = row?.localPath && fs.existsSync(row.localPath) ? row.localPath : null;
    const localPath = persistedPath ?? diskPath;
    const installed = !!localPath && fs.existsSync(localPath);
    let status: LlmInstallStatus = row?.status ?? (installed ? "installed" : "not_installed");
    if (!installed) {
      if (status === "installed" || status === "selected") {
        status = "not_installed";
      }
    } else if (status === "not_installed" || status === "downloading") {
      status = "installed";
    }
    return {
      installed,
      status,
      localPath,
      downloadProgress: row?.downloadProgress ?? null,
      errorMessage: row?.errorMessage ?? null,
      installedAt: row?.installedAt ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  }

  getState(): LlmStateSnapshot {
    return { model: this.buildDiskView() };
  }

  private setRow(update: Partial<PersistedLlmModelInstall> & Pick<PersistedLlmModelInstall, "status">) {
    const catalog = INTERNAL_AI_MODEL;
    const existing = this.repo.getByModelId(INTERNAL_ID);
    const row: PersistedLlmModelInstall = {
      modelId: INTERNAL_ID,
      installed: update.installed ?? existing?.installed ?? false,
      selected: update.selected ?? existing?.selected ?? false,
      status: update.status,
      localPath: update.localPath ?? existing?.localPath ?? null,
      fileName: update.fileName ?? existing?.fileName ?? null,
      sourceRepo: catalog.repo,
      sizeBytes: update.sizeBytes ?? existing?.sizeBytes ?? catalog.sizeBytes ?? null,
      downloadProgress: update.downloadProgress ?? existing?.downloadProgress ?? null,
      errorMessage: update.errorMessage ?? existing?.errorMessage ?? null,
      installedAt: update.installedAt ?? existing?.installedAt ?? null,
      updatedAt: now(),
    };
    this.repo.upsert(row);
  }

  async installModel(webContents?: WebContents): Promise<LlmStateSnapshot> {
    return this.enqueue(async () => {
      const catalog = INTERNAL_AI_MODEL;
      this.downloadAbort?.abort();
      const ac = new AbortController();
      this.downloadAbort = ac;

      this.repo.clearSelection();
      this.setRow({
        installed: false,
        selected: false,
        status: "downloading",
        localPath: null,
        fileName: null,
        errorMessage: null,
        downloadProgress: 0,
      });

      const progress = (p01: number) => {
        const progressPct = Math.round(Math.max(0, Math.min(1, p01)) * 100);
        this.setRow({
          status: "downloading",
          downloadProgress: progressPct,
        });
        this.emitProgress(webContents, {
          progress: progressPct,
          status: "downloading",
          message: "Downloading AI",
        });
      };

      try {
        progress(0.02);
        const modelPath = await modelDownloadService.downloadModel(catalog, {
          signal: ac.signal,
          onProgress: progress,
        });

        this.setRow({
          installed: true,
          selected: false,
          status: "installed",
          localPath: modelPath,
          fileName: path.basename(modelPath),
          errorMessage: null,
          downloadProgress: 100,
          installedAt: now(),
        });

        this.emitProgress(webContents, {
          progress: 100,
          status: "ready",
          message: "Preparing AI",
        });

        this.repo.clearSelection();
        modelRuntimeService.disposeModelOnly();
        this.emitProgress(webContents, {
          progress: 10,
          status: "loading",
          message: "Loading AI",
        });
        try {
          await modelRuntimeService.loadModel(INTERNAL_ID, modelPath);
          this.setRow({
            installed: true,
            selected: true,
            status: "selected",
            localPath: modelPath,
            fileName: path.basename(modelPath),
            errorMessage: null,
            downloadProgress: 100,
            installedAt: this.repo.getByModelId(INTERNAL_ID)?.installedAt ?? now(),
          });
          this.emitProgress(webContents, {
            progress: 100,
            status: "ready",
            message: "AI ready",
          });
        } catch (loadErr) {
          const loadMessage = loadErr instanceof Error ? loadErr.message : "Model load failed";
          this.setRow({
            installed: true,
            selected: false,
            status: "failed",
            localPath: modelPath,
            fileName: path.basename(modelPath),
            errorMessage: loadMessage,
            downloadProgress: 100,
          });
          this.emitProgress(webContents, {
            progress: 100,
            status: "failed",
            message: loadMessage,
          });
          throw loadErr;
        }

        return this.getState();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Download failed";
        const row = this.repo.getByModelId(INTERNAL_ID);
        const hadFile = row?.localPath && fs.existsSync(row.localPath);
        if (!hadFile) {
          this.setRow({
            installed: false,
            selected: false,
            status: "failed",
            errorMessage: message,
            downloadProgress: null,
          });
        }
        this.emitProgress(webContents, {
          progress: 0,
          status: "failed",
          message,
        });
        throw err;
      } finally {
        this.downloadAbort = null;
      }
    });
  }

  cancelDownload(): void {
    this.downloadAbort?.abort();
  }

  async loadModel(webContents?: WebContents): Promise<LlmStateSnapshot> {
    return this.enqueue(async () => {
      const catalog = INTERNAL_AI_MODEL;
      this.repo.clearSelection();
      modelRuntimeService.disposeModelOnly();

      this.emitProgress(webContents, {
        progress: 5,
        status: "loading",
        message: "Loading AI",
      });

      let modelPath = this.repo.getByModelId(INTERNAL_ID)?.localPath ?? null;
      if (!modelPath || !fs.existsSync(modelPath)) {
        modelPath = modelStorageService.resolveExistingPath();
      }
      if (!modelPath) {
        throw new Error("AI is not downloaded yet");
      }

      const validated = modelStorageService.validateModelFile(modelPath, catalog.sizeBytes);
      if (validated.ok === false) {
        throw new Error(validated.error);
      }

      try {
        await modelRuntimeService.loadModel(INTERNAL_ID, modelPath);
        this.setRow({
          installed: true,
          selected: true,
          status: "selected",
          localPath: modelPath,
          fileName: path.basename(modelPath),
          errorMessage: null,
          downloadProgress: 100,
          installedAt: this.repo.getByModelId(INTERNAL_ID)?.installedAt ?? now(),
        });
        this.emitProgress(webContents, {
          progress: 100,
          status: "ready",
          message: "AI ready",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Model load failed";
        this.setRow({
          installed: true,
          selected: false,
          status: "failed",
          localPath: modelPath,
          fileName: path.basename(modelPath),
          errorMessage: message,
        });
        this.emitProgress(webContents, {
          progress: 0,
          status: "failed",
          message,
        });
        throw err;
      }

      return this.getState();
    });
  }

  async unloadModel(): Promise<LlmStateSnapshot> {
    return this.enqueue(async () => {
      this.repo.clearSelection();
      await modelRuntimeService.unloadAll();
      return this.getState();
    });
  }

  async deleteModel(): Promise<LlmStateSnapshot> {
    return this.enqueue(async () => {
      if (modelRuntimeService.getLoadedModelId() === INTERNAL_ID) {
        await modelRuntimeService.unloadAll();
      }
      modelStorageService.deleteModelFiles(INTERNAL_AI_MODEL);
      this.repo.deleteByModelId(INTERNAL_ID);
      return this.getState();
    });
  }

  async restoreFromPersistence(): Promise<void> {
    if (this.startupRestoreAttempted) return;
    this.startupRestoreAttempted = true;
    this.migrateLegacyPersistence();

    const disk = modelStorageService.resolveExistingPath();
    const selectedId = this.repo.getSelectedModelId();
    if (!selectedId && !disk) {
      return;
    }

    const row = selectedId ? this.repo.getByModelId(selectedId) : null;
    const effectivePath = row?.localPath && fs.existsSync(row.localPath) ? row.localPath : disk;
    if (!effectivePath) {
      return;
    }
    if (row?.localPath && !fs.existsSync(row.localPath)) {
      const message = `Installed model file is missing: ${row.localPath}`;
      this.repo.clearSelection();
      this.setRow({
        installed: false,
        selected: false,
        status: "invalid",
        errorMessage: message,
      });
      return;
    }
    try {
      await this.loadModel(undefined);
    } catch {
      /* surface via getAssistantRuntimeState */
    }
  }

  async buildWalletContext(accountId: string): Promise<string> {
    try {
      return await buildAssistantContextDocument(accountId);
    } catch {
      return "";
    }
  }

  async chat(payload: {
    messages: ChatTurnMessage[];
    accountId: string;
    language: string;
    personalityId: string;
  }): Promise<{ content: string; metadata?: string | null }> {
    const model = modelRuntimeService.getModelOrThrow();
    const last = payload.messages[payload.messages.length - 1];
    let metadata: string | null = null;
    let walletContext = await this.buildWalletContext(payload.accountId);
    if (last?.role === "user") {
      const { blocks, systemAddendum } = await buildAssistantStructuredBlocks(
        payload.accountId,
        last.content,
      );
      if (blocks.length > 0) {
        metadata = JSON.stringify({ v: 1, structured: blocks });
      }
      if (systemAddendum) {
        walletContext = `${walletContext}${systemAddendum}`;
      }
    }
    const content = await assistantInferenceService.generateReply({
      model,
      messages: payload.messages,
      language: payload.language,
      personalityId: payload.personalityId,
      walletContext,
    });
    return { content, metadata };
  }
}

export const aiModelMainService = new AiModelMainService();
