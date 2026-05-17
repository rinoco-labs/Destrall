import { create } from "zustand";

type BrowserUiState = {
  lastUrlByAccount: Record<string, string>;
  setLastUrl: (accountId: string, url: string) => void;
};

export const useBrowserStore = create<BrowserUiState>((set) => ({
  lastUrlByAccount: {},
  setLastUrl: (accountId, url) =>
    set((state) => ({
      lastUrlByAccount: { ...state.lastUrlByAccount, [accountId]: url },
    })),
}));
