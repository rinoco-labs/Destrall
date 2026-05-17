import { create } from "zustand";
import type { DestrallWalletBridgeRequest } from "../types/browser.types";

export type PendingDappRequest = DestrallWalletBridgeRequest & {
  receivedAt: number;
};

type DappConnectionState = {
  pending: PendingDappRequest | null;
  setPending: (request: PendingDappRequest | null) => void;
};

export const useDappConnectionStore = create<DappConnectionState>((set) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
}));
