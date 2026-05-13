import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AssistantChatRequest,
  AssistantRuntimeState,
  LlmModelView,
  LlmStateSnapshot,
  ModelProgressEvent,
} from "../../shared/ipc";
import {
  desktopLlmAssistantRuntime,
  desktopLlmCancelDownload,
  desktopLlmChat,
  desktopLlmDeleteModel,
  desktopLlmGetState,
  desktopLlmInstallModel,
  desktopLlmOnModelProgress,
  desktopLlmSelectModel,
  desktopLlmUnloadModel,
} from "@/lib/desktopAi";
import { isDestrallDesktop } from "@/lib/desktopWallet";

let progressUnsub: (() => void) | null = null;

type AiModelStoreState = {
  availableModels: LlmModelView[];
  selectedModelId: string | null;
  downloadedModelIds: string[];
  activeModelId: string | null;
  isDownloading: boolean;
  downloadProgress: number;
  downloadingModelId: string | null;
  isLoadingModel: boolean;
  isModelLoaded: boolean;
  runtimeError: string | null;
  lastError: string | null;
  initializeModelState: () => Promise<void>;
  refreshFromMain: () => Promise<void>;
  selectModel: (modelId: string) => Promise<void>;
  downloadModel: (modelId: string) => Promise<void>;
  cancelDownload: (modelId: string) => Promise<void>;
  deleteModel: (modelId: string) => Promise<void>;
  loadModel: (modelId: string) => Promise<void>;
  unloadModel: () => Promise<void>;
  sendMessage: (payload: AssistantChatRequest) => Promise<string>;
  applyProgress: (event: ModelProgressEvent) => void;
};

function applySnapshot(
  set: (partial: Partial<AiModelStoreState>) => void,
  snap: LlmStateSnapshot,
  runtime: AssistantRuntimeState,
) {
  const downloadedModelIds = snap.models.filter((m) => m.installed).map((m) => m.id);
  set({
    availableModels: snap.models,
    selectedModelId: snap.selectedModelId,
    downloadedModelIds,
    activeModelId: runtime.selectedModelId,
    isModelLoaded: runtime.status === "ready",
    isLoadingModel: runtime.status === "loading",
    runtimeError: runtime.errorMessage,
  });
}

export const useAiModelStore = create<AiModelStoreState>()(
  persist(
    (set, get) => ({
      availableModels: [] as LlmModelView[],
      selectedModelId: null as string | null,
      downloadedModelIds: [] as string[],
      activeModelId: null as string | null,
      isDownloading: false,
      downloadProgress: 0,
      downloadingModelId: null as string | null,
      isLoadingModel: false,
      isModelLoaded: false,
      runtimeError: null as string | null,
      lastError: null as string | null,

      applyProgress: (event) => {
        set({
          downloadProgress: event.progress,
          isDownloading: event.status === "downloading",
          downloadingModelId: event.status === "downloading" ? event.modelId : null,
          lastError: event.status === "failed" ? event.message : null,
        });
        if (event.status === "ready" && event.progress >= 100) {
          set({ isDownloading: false, downloadingModelId: null });
        }
      },

      initializeModelState: async () => {
        if (!isDestrallDesktop()) return;
        progressUnsub?.();
        progressUnsub = desktopLlmOnModelProgress((e) => {
          get().applyProgress(e);
        });
        await get().refreshFromMain();
      },

      refreshFromMain: async () => {
        if (!isDestrallDesktop()) return;
        try {
          const snap = await desktopLlmGetState();
          const runtime = await desktopLlmAssistantRuntime();
          applySnapshot(set, snap, runtime);
          set({ lastError: null });
        } catch (e) {
          set({ lastError: e instanceof Error ? e.message : "Could not refresh model state" });
        }
      },

      selectModel: async (modelId) => {
        set({ selectedModelId: modelId });
      },

      downloadModel: async (modelId) => {
        if (!isDestrallDesktop()) throw new Error("Model download requires the Destrall desktop app.");
        set({ isDownloading: true, downloadingModelId: modelId, downloadProgress: 0, lastError: null });
        try {
          const snap = await desktopLlmInstallModel(modelId);
          const runtime = await desktopLlmAssistantRuntime();
          applySnapshot(set, snap, runtime);
        } catch (e) {
          const message = e instanceof Error ? e.message : "Download failed";
          set({ lastError: message });
          throw e;
        } finally {
          set({ isDownloading: false, downloadingModelId: null });
          await get().refreshFromMain();
        }
      },

      cancelDownload: async (modelId) => {
        if (!isDestrallDesktop()) return;
        await desktopLlmCancelDownload(modelId);
        await get().refreshFromMain();
      },

      deleteModel: async (modelId) => {
        if (!isDestrallDesktop()) throw new Error("Model delete requires the Destrall desktop app.");
        const snap = await desktopLlmDeleteModel(modelId);
        const runtime = await desktopLlmAssistantRuntime();
        applySnapshot(set, snap, runtime);
      },

      loadModel: async (modelId) => {
        if (!isDestrallDesktop()) throw new Error("Model load requires the Destrall desktop app.");
        set({ isLoadingModel: true, lastError: null });
        try {
          const snap = await desktopLlmSelectModel(modelId);
          const runtime = await desktopLlmAssistantRuntime();
          applySnapshot(set, snap, runtime);
        } catch (e) {
          const message = e instanceof Error ? e.message : "Load failed";
          set({ lastError: message });
          throw e;
        } finally {
          set({ isLoadingModel: false });
        }
      },

      unloadModel: async () => {
        if (!isDestrallDesktop()) return;
        const snap = await desktopLlmUnloadModel();
        const runtime = await desktopLlmAssistantRuntime();
        applySnapshot(set, snap, runtime);
      },

      sendMessage: async (payload) => {
        if (!isDestrallDesktop()) {
          throw new Error("Assistant chat requires the Destrall desktop app.");
        }
        return desktopLlmChat(payload);
      },
    }),
    {
      name: "destrall.ai-model",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? (undefined as unknown as Storage)
          : localStorage,
      ),
      partialize: () => ({}),
    },
  ),
);
