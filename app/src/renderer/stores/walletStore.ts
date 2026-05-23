import { create } from "zustand";
import type {
  WalletAccount,
  WalletProfile,
  WalletRestoreStatus,
} from "../../shared/wallet/types";
import {
  desktopCreateAccount,
  desktopCreateWallet,
  desktopDisconnectWallet,
  desktopGetWalletStatus,
  desktopImportWallet,
  desktopRefreshWallet,
  desktopRenameAccount,
  desktopSwitchAccount,
  desktopLockWallet,
  desktopUnlockWallet,
  desktopUpdateAccountIcon,
  isDestrallDesktop,
} from "@/lib/desktopWallet";
import { TERMS_NOT_ACCEPTED_ERROR } from "../../shared/wallet/terms";
import { useOnboardingStore } from "@/stores/onboardingStore";

type WalletStoreState = {
  restoreStatus: WalletRestoreStatus;
  error: string | null;
  hasVault: boolean;
  isUnlocked: boolean;
  activeAccountId: string | null;
  profiles: WalletProfile[];
  accounts: WalletAccount[];
  initializeWalletState: () => Promise<void>;
  refreshWallets: () => Promise<void>;
  createWallet: (params: {
    mnemonic: string;
    password: string;
    profileName?: string;
    accountName?: string;
    termsAccepted: true;
  }) => Promise<WalletAccount>;
  importWallet: (params: {
    mnemonic: string;
    password: string;
    profileName?: string;
    accountName?: string;
    termsAccepted: true;
  }) => Promise<WalletAccount>;
  createAccount: (name: string) => Promise<WalletAccount>;
  switchAccount: (accountId: string) => Promise<void>;
  renameAccount: (accountId: string, name: string) => Promise<WalletAccount>;
  updateAccountIcon: (
    accountId: string,
    icon?: string | null,
    color?: string | null,
  ) => Promise<WalletAccount>;
  unlockWallet: (password: string) => Promise<void>;
  lockWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
};

function applySnapshot(
  set: (partial: Partial<WalletStoreState>) => void,
  snapshot: Awaited<ReturnType<typeof desktopGetWalletStatus>>,
) {
  set({
    hasVault: snapshot.hasVault,
    isUnlocked: snapshot.isUnlocked,
    activeAccountId: snapshot.activeAccountId,
    profiles: snapshot.profiles,
    accounts: snapshot.accounts,
    restoreStatus: "ready",
    error: null,
  });
}

export const useWalletStore = create<WalletStoreState>((set, get) => ({
  restoreStatus: "idle",
  error: null,
  hasVault: false,
  isUnlocked: false,
  activeAccountId: null,
  profiles: [],
  accounts: [],

  initializeWalletState: async () => {
    if (!isDestrallDesktop()) {
      set({
        restoreStatus: "ready",
        hasVault: false,
        isUnlocked: false,
        activeAccountId: null,
        profiles: [],
        accounts: [],
        error: "Wallet services are only available in the Destrall desktop app.",
      });
      return;
    }

    set({ restoreStatus: "loading", error: null });
    try {
      const snapshot = await desktopGetWalletStatus();
      applySnapshot(set, snapshot);
    } catch (error) {
      set({
        restoreStatus: "error",
        error: error instanceof Error ? error.message : "Failed to restore wallet state",
      });
    }
  },

  refreshWallets: async () => {
    const snapshot = await desktopRefreshWallet();
    applySnapshot(set, snapshot);
  },

  createWallet: async (params) => {
    if (params.termsAccepted !== true) {
      throw new Error(TERMS_NOT_ACCEPTED_ERROR);
    }
    const account = await desktopCreateWallet(params);
    await get().refreshWallets();
    return account;
  },

  importWallet: async (params) => {
    if (params.termsAccepted !== true) {
      throw new Error(TERMS_NOT_ACCEPTED_ERROR);
    }
    const account = await desktopImportWallet(params);
    await get().refreshWallets();
    return account;
  },

  createAccount: async (name) => {
    const account = await desktopCreateAccount({ name });
    await get().refreshWallets();
    return account;
  },

  switchAccount: async (accountId) => {
    await desktopSwitchAccount(accountId);
    await get().refreshWallets();
  },

  renameAccount: async (accountId, name) => {
    const account = await desktopRenameAccount(accountId, name);
    await get().refreshWallets();
    return account;
  },

  updateAccountIcon: async (accountId, icon, color) => {
    const account = await desktopUpdateAccountIcon(accountId, icon, color);
    await get().refreshWallets();
    return account;
  },

  unlockWallet: async (password) => {
    await desktopUnlockWallet(password);
    await get().refreshWallets();
  },

  lockWallet: async () => {
    await desktopLockWallet();
    await get().refreshWallets();
  },

  disconnectWallet: async () => {
    await desktopDisconnectWallet();
    useOnboardingStore.getState().reset();
    set({
      hasVault: false,
      isUnlocked: false,
      activeAccountId: null,
      profiles: [],
      accounts: [],
      restoreStatus: "ready",
      error: null,
    });
  },
}));

export function getActiveWalletAccount(state: WalletStoreState): WalletAccount | null {
  if (!state.activeAccountId) return state.accounts[0] ?? null;
  return state.accounts.find((account) => account.id === state.activeAccountId) ?? null;
}
