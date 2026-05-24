import type { Llama, LlamaModel } from "node-llama-cpp";
import {
  getLlmEngineProbeResult,
  isLlmEngineAvailable,
  LOCAL_AI_ENGINE_UNAVAILABLE_MESSAGE,
  probeLlmEngine,
} from "./llmEngineProbe";

type RuntimeStatus = "idle" | "loading" | "ready" | "failed";

/**
 * Holds node-llama-cpp runtime state in the main process.
 * Avoids loading multiple GGUF weights concurrently.
 */
export class ModelRuntimeService {
  private llama: Llama | null = null;
  private model: LlamaModel | null = null;
  private loadedModelId: string | null = null;
  private loadPromise: Promise<void> | null = null;
  private status: RuntimeStatus = "idle";
  private errorMessage: string | null = null;

  getLoadedModelId(): string | null {
    return this.loadedModelId;
  }

  getStatus(): RuntimeStatus {
    return this.status;
  }

  getError(): string | null {
    return this.errorMessage;
  }

  isReadyFor(modelId: string): boolean {
    return this.status === "ready" && this.loadedModelId === modelId;
  }

  async loadModel(modelId: string, modelPath: string): Promise<void> {
    if (this.isReadyFor(modelId)) {
      return;
    }
    if (this.loadPromise) {
      await this.loadPromise;
      if (this.isReadyFor(modelId)) return;
    }

    this.loadPromise = (async () => {
      this.status = "loading";
      this.errorMessage = null;
      this.disposeModelOnly();
      try {
        const engine = getLlmEngineProbeResult() ?? (await probeLlmEngine());
        if (!engine.ok) {
          throw new Error(engine.errorMessage ?? LOCAL_AI_ENGINE_UNAVAILABLE_MESSAGE);
        }
        if (!this.llama) {
          const { getLlama } = await import("node-llama-cpp");
          console.info("[llm] initializing getLlama (build=never)");
          this.llama = await getLlama({ build: "never" });
          console.info("[llm] getLlama ready");
        }
        this.model = await this.llama.loadModel({ modelPath });
        this.loadedModelId = modelId;
        this.status = "ready";
      } catch (err) {
        this.loadedModelId = null;
        this.model = null;
        this.status = "failed";
        this.errorMessage = err instanceof Error ? err.message : "Model load failed";
        throw err;
      } finally {
        this.loadPromise = null;
      }
    })();

    await this.loadPromise;
  }

  getModelOrThrow(): LlamaModel {
    if (!this.model) {
      throw new Error("Model runtime not loaded");
    }
    return this.model;
  }

  disposeModelOnly(): void {
    try {
      this.model?.dispose();
    } catch {
      /* noop */
    }
    this.model = null;
    this.loadedModelId = null;
  }

  async unloadAll(): Promise<void> {
    this.disposeModelOnly();
    try {
      if (this.llama) {
        await this.llama.dispose();
      }
    } catch {
      /* noop */
    }
    this.llama = null;
    this.status = "idle";
    this.errorMessage = null;
  }
}

export const modelRuntimeService = new ModelRuntimeService();
