import type { WalletAccount, WalletStatusSnapshot } from "./wallet/types";

export type RpcResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type WalletCreateRequest = {
  mnemonic: string;
  password: string;
  profileName?: string;
  accountName?: string;
  imported?: boolean;
};

export type DestrallApi = {
  wallet: {
    getStatus: () => Promise<RpcResult<WalletStatusSnapshot>>;
    previewMnemonic: () => Promise<RpcResult<string>>;
    createWallet: (payload: WalletCreateRequest) => Promise<RpcResult<WalletAccount>>;
    importWallet: (payload: WalletCreateRequest) => Promise<RpcResult<WalletAccount>>;
    createAccount: (payload: { name: string }) => Promise<RpcResult<WalletAccount>>;
    switchAccount: (accountId: string) => Promise<RpcResult<{ activeAccountId: string }>>;
    renameAccount: (payload: { accountId: string; name: string }) => Promise<RpcResult<WalletAccount>>;
    updateAccountIcon: (payload: {
      accountId: string;
      icon?: string | null;
      color?: string | null;
    }) => Promise<RpcResult<WalletAccount>>;
    unlockSession: (password: string) => Promise<RpcResult<{ ok: true }>>;
    lockSession: () => Promise<RpcResult<{ ok: true }>>;
    viewSeedPhrase: (password: string) => Promise<RpcResult<string>>;
    disconnect: () => Promise<RpcResult<{ ok: true }>>;
    refresh: () => Promise<RpcResult<WalletStatusSnapshot>>;
  };
};

export const IPCChannels = {
  walletGetStatus: "wallet:get-status",
  walletPreviewMnemonic: "wallet:preview-mnemonic",
  walletCreate: "wallet:create",
  walletImport: "wallet:import",
  walletCreateAccount: "wallet:create-account",
  walletSwitchAccount: "wallet:switch-account",
  walletRenameAccount: "wallet:rename-account",
  walletUpdateAccountIcon: "wallet:update-account-icon",
  walletUnlockSession: "wallet:unlock-session",
  walletLockSession: "wallet:lock-session",
  walletViewSeedPhrase: "wallet:view-seed-phrase",
  walletDisconnect: "wallet:disconnect",
  walletRefresh: "wallet:refresh",
} as const;
