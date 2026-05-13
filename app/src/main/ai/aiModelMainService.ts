import fs from "node:fs";
import path from "node:path";
import type { WebContents } from "electron";
import { MODEL_CATALOG, MODEL_CATALOG_BY_ID } from "../../ai/modelCatalog";
import {
  IPCChannels,
  type AssistantRuntimeState,
  type LlmInstallStatus,
  type LlmModelView,
  type LlmStateSnapshot,
  type ModelProgressEvent,
} from "../../shared/ipc";
import { getDatabase } from "../persistence/database";
import { LlmModelRepository, type PersistedLlmModelInstall } from "../persistence/repositories/llmModelRepository";
import { walletService } from "../wallet/walletService";
import { assistantInferenceService, type ChatTurnMessage } from "./assistantInferenceService";
import { modelDownloadService } from "./modelDownloadService";
import { modelRuntimeService } from "./modelRuntimeService";
import { modelStorageService } from "./modelStorageService";

function now() {
  return Date.now();
}

export class AiModelMainService {
  private readonly repo: LlmModelRepository;
  private startupRestoreAttempted = false;
  private tail: Promise<unknown> = Promise.resolve();
  private readonly downloadControllers = new Map<string, AbortController>();

  constructor() {
    this.repo = new LlmModelRepository(getDatabase());
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run: Promise<T> = this.tail.then(() => fn());
    this.tail = run.finally(() => {});
    return run;
  }

  private emitProgress(webContents: WebContents | undefined, evt: ModelProgressEvent) {
    try {
      webContents?.send(IPCChannels.llmModelProgress, evt);
    } catch {
      /* window may be destroyed */
    }
  }

  getAssistantRuntimeState(): AssistantRuntimeState {
    return {
      selectedModelId: modelRuntimeService.getLoadedModelId(),
      status: modelRuntimeService.getStatus(),
      errorMessage: modelRuntimeService.getError(),
    };
  }

  getState(): LlmStateSnapshot {
    const persisted = this.repo.list();
    const byId = new Map(persisted.map((m) => [m.modelId, m]));
    const models: LlmModelView[] = MODEL_CATALOG.map((catalog) => {
      const row = byId.get(catalog.id);
      const diskPath = modelStorageService.resolveExistingPathForModelId(catalog.id);
      const persistedPath = row?.localPath && fs.existsSync(row.localPath) ? row.localPath : null;
      const localPath = persistedPath ?? diskPath;
      const installed = !!localPath && fs.existsSync(localPath);
      const fileName = localPath ? path.basename(localPath) : null;
      let status: LlmInstallStatus = row?.status ?? (installed ? "installed" : "not_installed");
      if (!installed) {
        if (status === "installed" || status === "selected") {
          status = "not_installed";
        }
      } else if (status === "not_installed" || status === "downloading") {
        status = "installed";
      }
      return {
        ...catalog,
        installed,
        selected: row?.selected ?? false,
        status,
        localPath,
        fileName,
        downloadProgress: row?.downloadProgress ?? null,
        errorMessage: row?.errorMessage ?? null,
        installedAt: row?.installedAt ?? null,
        updatedAt: row?.updatedAt ?? null,
      };
    });
    const selectedModelId =
      models.find((m) => m.selected)?.id ?? this.repo.getSelectedModelId() ?? null;
    return { models, selectedModelId };
  }

  private setRow(modelId: string, update: Partial<PersistedLlmModelInstall> & Pick<PersistedLlmModelInstall, "status">) {
    const catalog = MODEL_CATALOG_BY_ID[modelId];
    if (!catalog) throw new Error(`Unknown model: ${modelId}`);
    const existing = this.repo.getByModelId(modelId);
    const row: PersistedLlmModelInstall = {
      modelId,
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

  async installModel(modelId: string, webContents?: WebContents): Promise<LlmStateSnapshot> {
    return this.enqueue(async () => {
      const catalog = MODEL_CATALOG_BY_ID[modelId];
      if (!catalog) throw new Error(`Unknown model: ${modelId}`);

      const existingAbort = this.downloadControllers.get(modelId);
      existingAbort?.abort();
      const ac = new AbortController();
      this.downloadControllers.set(modelId, ac);

      this.setRow(modelId, {
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
        this.setRow(modelId, {
          status: "downloading",
          downloadProgress: progressPct,
        });
        this.emitProgress(webContents, {
          modelId,
          progress: progressPct,
          status: "downloading",
          message: "Downloading model",
        });
      };

      try {
        progress(0.02);
        const modelPath = await modelDownloadService.downloadModel(catalog, {
          signal: ac.signal,
          onProgress: progress,
        });

        this.setRow(modelId, {
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
          modelId,
          progress: 100,
          status: "ready",
          message: "Model downloaded",
        });

        this.setRow(modelId, {
          installed: true,
          selected: false,
          status: "installed",
          localPath: modelPath,
          fileName: path.basename(modelPath),
          errorMessage: null,
          downloadProgress: 100,
          installedAt: now(),
        });

        this.repo.clearSelection();
        modelRuntimeService.disposeModelOnly();
        this.emitProgress(webContents, {
          modelId,
          progress: 5,
          status: "downloading",
          message: "Loading model weights",
        });
        try {
          await modelRuntimeService.loadModel(modelId, modelPath);
          this.setRow(modelId, {
            installed: true,
            selected: true,
            status: "selected",
            localPath: modelPath,
            fileName: path.basename(modelPath),
            errorMessage: null,
            downloadProgress: 100,
            installedAt: this.repo.getByModelId(modelId)?.installedAt ?? now(),
          });
          this.emitProgress(webContents, {
            modelId,
            progress: 100,
            status: "ready",
            message: "Model ready",
          });
        } catch (loadErr) {
          const loadMessage = loadErr instanceof Error ? loadErr.message : "Model load failed";
          this.setRow(modelId, {
            installed: true,
            selected: false,
            status: "failed",
            localPath: modelPath,
            fileName: path.basename(modelPath),
            errorMessage: loadMessage,
            downloadProgress: 100,
          });
          this.emitProgress(webContents, {
            modelId,
            progress: 100,
            status: "failed",
            message: loadMessage,
          });
          throw loadErr;
        }

        return this.getState();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Download failed";
        const row = this.repo.getByModelId(modelId);
        const hadFile = row?.localPath && fs.existsSync(row.localPath);
        if (!hadFile) {
          this.setRow(modelId, {
            installed: false,
            selected: false,
            status: "failed",
            errorMessage: message,
            downloadProgress: null,
          });
        }
        this.emitProgress(webContents, {
          modelId,
          progress: 0,
          status: "failed",
          message,
        });
        throw err;
      } finally {
        this.downloadControllers.delete(modelId);
      }
    });
  }

  cancelDownload(modelId: string): void {
    this.downloadControllers.get(modelId)?.abort();
  }

  async selectAndLoadModel(modelId: string, webContents?: WebContents): Promise<LlmStateSnapshot> {
    return this.enqueue(async () => {
      const catalog = MODEL_CATALOG_BY_ID[modelId];
      if (!catalog) throw new Error(`Unknown model: ${modelId}`);

      this.repo.clearSelection();
      modelRuntimeService.disposeModelOnly();

      this.emitProgress(webContents, {
        modelId,
        progress: 5,
        status: "downloading",
        message: "Loading model weights",
      });

      let modelPath = this.repo.getByModelId(modelId)?.localPath ?? null;
      if (!modelPath || !fs.existsSync(modelPath)) {
        modelPath = modelStorageService.resolveExistingPathForModelId(modelId);
      }
      if (!modelPath) {
        throw new Error("Model is not downloaded yet");
      }

      const validated = modelStorageService.validateModelFile(modelPath, catalog.sizeBytes);
      if (validated.ok === false) {
        throw new Error(validated.error);
      }

      try {
        await modelRuntimeService.loadModel(modelId, modelPath);
        this.setRow(modelId, {
          installed: true,
          selected: true,
          status: "selected",
          localPath: modelPath,
          fileName: path.basename(modelPath),
          errorMessage: null,
          downloadProgress: 100,
          installedAt: this.repo.getByModelId(modelId)?.installedAt ?? now(),
        });
        this.emitProgress(webContents, {
          modelId,
          progress: 100,
          status: "ready",
          message: "Model ready",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Model load failed";
        this.setRow(modelId, {
          installed: true,
          selected: false,
          status: "failed",
          localPath: modelPath,
          fileName: path.basename(modelPath),
          errorMessage: message,
        });
        this.emitProgress(webContents, {
          modelId,
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

  async deleteModel(modelId: string): Promise<LlmStateSnapshot> {
    return this.enqueue(async () => {
      const catalog = MODEL_CATALOG_BY_ID[modelId];
      if (!catalog) throw new Error(`Unknown model: ${modelId}`);

      if (modelRuntimeService.getLoadedModelId() === modelId) {
        await modelRuntimeService.unloadAll();
      }

      modelStorageService.deleteModelFiles(catalog);
      this.repo.deleteByModelId(modelId);
      return this.getState();
    });
  }

  async restoreFromPersistence(): Promise<void> {
    if (this.startupRestoreAttempted) return;
    this.startupRestoreAttempted = true;
    const selectedId = this.repo.getSelectedModelId();
    if (!selectedId) {
      return;
    }
    const row = this.repo.getByModelId(selectedId);
    if (row?.localPath && !fs.existsSync(row.localPath)) {
      const message = `Installed model file is missing: ${row.localPath}`;
      this.repo.clearSelection();
      this.setRow(selectedId, {
        installed: false,
        selected: false,
        status: "invalid",
        errorMessage: message,
      });
      return;
    }
    try {
      await this.selectAndLoadModel(selectedId, undefined);
    } catch {
      /* surface via getAssistantRuntimeState */
    }
  }

  buildWalletContext(accountId: string): string {
    try {
      const status = walletService.getStatus();
      const account = status.accounts.find((a) => a.id === accountId);
      if (!account) {
        return `No wallet account found for id ${accountId}.`;
      }
      return [
        `Active account: ${account.name} (${account.id})`,
        `Chain: ${account.chain}`,
        `Address: ${account.address}`,
      ].join("\n");
    } catch {
      return "";
    }
  }

  async chat(payload: {
    messages: ChatTurnMessage[];
    accountId: string;
    language: string;
    personalityId: string;
  }): Promise<string> {
    const model = modelRuntimeService.getModelOrThrow();
    const walletContext = this.buildWalletContext(payload.accountId);
    return assistantInferenceService.generateReply({
      model,
      messages: payload.messages,
      language: payload.language,
      personalityId: payload.personalityId,
      walletContext,
    });
  }
}

export const aiModelMainService = new AiModelMainService();
