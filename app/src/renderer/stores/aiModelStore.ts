import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AssistantChatRequest,
  AssistantChatResponse,
  AssistantRuntimeState,
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
  desktopLlmLoadModel,
  desktopLlmUnloadModel,
} from "@/lib/desktopAi";
import { isDestrallDesktop } from "@/lib/desktopWallet";

let progressUnsub: (() => void) | null = null;
let autoLoadOnce = false;

type AiModelStoreState = {
  isDownloaded: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  initializeModel: () => Promise<void>;
  refreshFromMain: () => Promise<void>;
  downloadModel: () => Promise<void>;
  cancelDownload: () => Promise<void>;
  deleteModel: () => Promise<void>;
  loadModel: () => Promise<void>;
  unloadModel: () => Promise<void>;
  sendMessage: (payload: AssistantChatRequest) => Promise<AssistantChatResponse>;
  applyProgress: (event: ModelProgressEvent) => void;
};

function deriveError(model: LlmStateSnapshot["model"], runtime: AssistantRuntimeState): string | null {
  return runtime.errorMessage ?? model.errorMessage ?? null;
}

function applySnapshot(
  set: (partial: Partial<AiModelStoreState>) => void,
  snap: LlmStateSnapshot,
  runtime: AssistantRuntimeState,
) {
  const installed = snap.model.installed;
  set({
    isDownloaded: installed,
    isLoaded: runtime.status === "ready",
    isLoading: runtime.status === "loading",
    error: deriveError(snap.model, runtime),
  });
}

export const useAiModelStore = create<AiModelStoreState>()(
  persist(
    (set, get) => ({
      isDownloaded: false,
      isDownloading: false,
      downloadProgress: 0,
      isLoading: false,
      isLoaded: false,
      error: null as string | null,

      applyProgress: (event) => {
        if (event.status === "failed") {
          set({
            downloadProgress: event.progress,
            isDownloading: false,
            isLoading: false,
            error: event.message,
          });
          return;
        }
        set({
          downloadProgress: event.progress,
          isDownloading: event.status === "downloading",
          isLoading: event.status === "loading",
          error: null,
        });
        if (event.status === "ready" && event.progress >= 100) {
          set({ isDownloading: false, isLoading: false });
        }
      },

      initializeModel: async () => {
        if (!isDestrallDesktop()) return;
        progressUnsub?.();
        progressUnsub = desktopLlmOnModelProgress((e) => {
          get().applyProgress(e);
        });
        await get().refreshFromMain();
        const s = get();
        if (!autoLoadOnce && s.isDownloaded && !s.isLoaded && !s.isLoading) {
          autoLoadOnce = true;
          try {
            await get().loadModel();
          } catch {
            /* surfaced via error + refresh */
          }
        }
      },

      refreshFromMain: async () => {
        if (!isDestrallDesktop()) return;
        try {
          const snap = await desktopLlmGetState();
          const runtime = await desktopLlmAssistantRuntime();
          applySnapshot(set, snap, runtime);
        } catch (e) {
          set({ error: e instanceof Error ? e.message : "Could not refresh AI state" });
        }
      },

      downloadModel: async () => {
        if (!isDestrallDesktop()) throw new Error("AI download requires the Destrall desktop app.");
        set({ isDownloading: true, downloadProgress: 0, error: null });
        try {
          const snap = await desktopLlmInstallModel();
          const runtime = await desktopLlmAssistantRuntime();
          applySnapshot(set, snap, runtime);
        } catch (e) {
          const message = e instanceof Error ? e.message : "Download failed";
          set({ error: message });
          throw e;
        } finally {
          set({ isDownloading: false });
          await get().refreshFromMain();
        }
      },

      cancelDownload: async () => {
        if (!isDestrallDesktop()) return;
        await desktopLlmCancelDownload();
        await get().refreshFromMain();
      },

      deleteModel: async () => {
        if (!isDestrallDesktop()) throw new Error("Deleting AI requires the Destrall desktop app.");
        const snap = await desktopLlmDeleteModel();
        const runtime = await desktopLlmAssistantRuntime();
        applySnapshot(set, snap, runtime);
      },

      loadModel: async () => {
        if (!isDestrallDesktop()) throw new Error("Loading AI requires the Destrall desktop app.");
        set({ isLoading: true, error: null });
        try {
          const snap = await desktopLlmLoadModel();
          const runtime = await desktopLlmAssistantRuntime();
          applySnapshot(set, snap, runtime);
        } catch (e) {
          const message = e instanceof Error ? e.message : "Load failed";
          set({ error: message });
          throw e;
        } finally {
          set({ isLoading: false });
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
