import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// IMPORTANT: never store seed phrases, private keys, or signed transactions here.
// This store is for app-level metadata only.

export type AccountMeta = {
  id: string;
  name: string;
  address: string;
};

type WalletState = {
  walletExists: boolean;
  activeAccountId: string | null;
  accounts: AccountMeta[];
  balancesCache: Record<string, Record<string, number>>; // accountId -> token -> balance
  setWalletExists: (v: boolean) => void;
  setActiveAccount: (id: string) => void;
  addAccount: (acc: AccountMeta) => void;
  removeAccount: (id: string) => void;
  renameAccount: (id: string, name: string) => void;
  setBalance: (accountId: string, token: string, value: number) => void;
};

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      walletExists: false,
      activeAccountId: null,
      accounts: [],
      balancesCache: {},
      setWalletExists: (walletExists) => set({ walletExists }),
      setActiveAccount: (activeAccountId) => set({ activeAccountId }),
      addAccount: (acc) =>
        set((s) => ({
          accounts: [...s.accounts, acc],
          activeAccountId: s.activeAccountId ?? acc.id,
          walletExists: true,
        })),
      removeAccount: (id) =>
        set((s) => {
          const accounts = s.accounts.filter((a) => a.id !== id);
          return {
            accounts,
            activeAccountId:
              s.activeAccountId === id ? (accounts[0]?.id ?? null) : s.activeAccountId,
          };
        }),
      renameAccount: (id, name) =>
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, name } : a)),
        })),
      setBalance: (accountId, token, value) =>
        set((s) => ({
          balancesCache: {
            ...s.balancesCache,
            [accountId]: { ...(s.balancesCache[accountId] ?? {}), [token]: value },
          },
        })),
    }),
    {
      name: "destrall.wallet",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? (undefined as unknown as Storage)
          : localStorage,
      ),
      partialize: (s) => ({
        walletExists: s.walletExists,
        activeAccountId: s.activeAccountId,
        accounts: s.accounts,
        balancesCache: s.balancesCache,
      }),
    },
  ),
);
