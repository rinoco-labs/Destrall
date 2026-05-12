import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ModelStatus = "idle" | "downloading" | "ready" | "error";

type AiState = {
  selectedModelId: string | null;
  installedModels: string[];
  modelDownloadProgress: Record<string, number>; // 0..1
  activeModelStatus: ModelStatus;
  selectModel: (id: string | null) => void;
  setProgress: (id: string, p: number) => void;
  markInstalled: (id: string) => void;
  setStatus: (s: ModelStatus) => void;
  removeModel: (id: string) => void;
};

export const useAiStore = create<AiState>()(
  persist(
    (set) => ({
      selectedModelId: null,
      installedModels: [],
      modelDownloadProgress: {},
      activeModelStatus: "idle",
      selectModel: (selectedModelId) => set({ selectedModelId }),
      setProgress: (id, p) =>
        set((s) => ({
          modelDownloadProgress: { ...s.modelDownloadProgress, [id]: p },
        })),
      markInstalled: (id) =>
        set((s) => ({
          installedModels: s.installedModels.includes(id)
            ? s.installedModels
            : [...s.installedModels, id],
          activeModelStatus: "ready",
          selectedModelId: s.selectedModelId ?? id,
        })),
      setStatus: (activeModelStatus) => set({ activeModelStatus }),
      removeModel: (id) =>
        set((s) => ({
          installedModels: s.installedModels.filter((m) => m !== id),
          selectedModelId: s.selectedModelId === id ? null : s.selectedModelId,
        })),
    }),
    {
      name: "destrall.ai",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? (undefined as unknown as Storage)
          : localStorage,
      ),
      partialize: (s) => ({
        selectedModelId: s.selectedModelId,
        installedModels: s.installedModels,
      }),
    },
  ),
);
