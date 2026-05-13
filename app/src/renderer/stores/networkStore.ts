import { create } from "zustand";
import type { ChainNetworkStatePayload } from "../../shared/ipc";
import type { ChainId } from "../../shared/wallet/types";
import type { SuiChainEnvironment } from "../../config/chains/sui";
import { desktopGetChainNetworkState, desktopSetChainNetwork } from "@/lib/desktopChain";
import { isDestrallDesktop } from "@/lib/desktopWallet";

type NetworkStoreState = {
  network: ChainNetworkStatePayload | null;
  error: string | null;
  initializeNetworkState: () => Promise<void>;
  setSuiEnvironment: (env: SuiChainEnvironment) => Promise<void>;
  setActiveChain: (chain: ChainId) => Promise<void>;
};

export const useNetworkStore = create<NetworkStoreState>((set, get) => ({
  network: null,
  error: null,

  initializeNetworkState: async () => {
    if (!isDestrallDesktop()) {
      set({ network: null, error: "Not running in Destrall desktop." });
      return;
    }
    set({ error: null });
    try {
      const network = await desktopGetChainNetworkState();
      set({ network });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to load network",
      });
    }
  },

  setSuiEnvironment: async (env: SuiChainEnvironment) => {
    const current = get().network;
    const chain = current?.activeChain ?? "sui";
    const network = await desktopSetChainNetwork({ activeChain: chain, suiEnvironment: env });
    set({ network, error: null });
  },

  setActiveChain: async (chain: ChainId) => {
    const current = get().network;
    const suiEnv = current?.activeEnvironment ?? "mainnet";
    const network = await desktopSetChainNetwork({ activeChain: chain, suiEnvironment: suiEnv });
    set({ network, error: null });
  },
}));
