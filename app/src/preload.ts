import { contextBridge, ipcRenderer } from "electron";
import {
  IPCChannels,
  type AssistantChatRequest,
  type DestrallApi,
  type ModelProgressEvent,
  type WalletCreateRequest,
} from "./shared/ipc";

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
  llm: {
    getState: () => ipcRenderer.invoke(IPCChannels.llmGetState),
    installModel: (modelId: string) => ipcRenderer.invoke(IPCChannels.llmInstallModel, modelId),
    selectModel: (modelId: string) => ipcRenderer.invoke(IPCChannels.llmSelectModel, modelId),
    unloadModel: () => ipcRenderer.invoke(IPCChannels.llmUnloadModel),
    deleteModel: (modelId: string) => ipcRenderer.invoke(IPCChannels.llmDeleteModel, modelId),
    cancelDownload: (modelId: string) =>
      ipcRenderer.invoke(IPCChannels.llmCancelDownload, modelId),
    assistantRuntime: () => ipcRenderer.invoke(IPCChannels.llmAssistantRuntime),
    chat: (payload: AssistantChatRequest) => ipcRenderer.invoke(IPCChannels.llmChat, payload),
    onModelProgress: (listener: (event: ModelProgressEvent) => void) => {
      const channel = IPCChannels.llmModelProgress;
      const wrapped = (_: unknown, data: ModelProgressEvent) => listener(data);
      ipcRenderer.on(channel, wrapped);
      return () => {
        ipcRenderer.removeListener(channel, wrapped);
      };
    },
  },
};

contextBridge.exposeInMainWorld("destrallApi", api);
