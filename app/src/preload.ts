import { contextBridge, ipcRenderer } from "electron";
import { IPCChannels, type DestrallApi, type WalletCreateRequest } from "./shared/ipc";

const api: DestrallApi = {
  wallet: {
    getStatus: () => ipcRenderer.invoke(IPCChannels.walletGetStatus),
    previewMnemonic: () => ipcRenderer.invoke(IPCChannels.walletPreviewMnemonic),
    createWallet: (payload: WalletCreateRequest) =>
      ipcRenderer.invoke(IPCChannels.walletCreate, payload),
    importWallet: (payload: WalletCreateRequest) =>
      ipcRenderer.invoke(IPCChannels.walletImport, payload),
    createAccount: (payload) => ipcRenderer.invoke(IPCChannels.walletCreateAccount, payload),
    switchAccount: (accountId) =>
      ipcRenderer.invoke(IPCChannels.walletSwitchAccount, { accountId }),
    renameAccount: (payload) => ipcRenderer.invoke(IPCChannels.walletRenameAccount, payload),
    updateAccountIcon: (payload) =>
      ipcRenderer.invoke(IPCChannels.walletUpdateAccountIcon, payload),
    unlockSession: (password) =>
      ipcRenderer.invoke(IPCChannels.walletUnlockSession, { password }),
    lockSession: () => ipcRenderer.invoke(IPCChannels.walletLockSession),
    viewSeedPhrase: (password) =>
      ipcRenderer.invoke(IPCChannels.walletViewSeedPhrase, { password }),
    disconnect: () => ipcRenderer.invoke(IPCChannels.walletDisconnect),
    refresh: () => ipcRenderer.invoke(IPCChannels.walletRefresh),
  },
};

contextBridge.exposeInMainWorld("destrallApi", api);
