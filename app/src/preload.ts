import { contextBridge, ipcRenderer } from "electron";
import {
  IPCChannels,
  type AssistantChatRequest,
  type DestrallApi,
  type ModelProgressEvent,
  type UpdateInfo,
  type WalletCreateRequest,
} from "./shared/ipc";
import type { CriticalFlowType } from "./shared/criticalFlows";
import type { DailyBriefAssistantMemoryPayload } from "./shared/dailyBriefMemory";
import type { ChainId } from "./shared/wallet/types";
import type { SuiChainEnvironment } from "./config/chains/sui";

const api: DestrallApi = {
  app: {
    openExternalUrl: (payload) => ipcRenderer.invoke(IPCChannels.appOpenExternalUrl, payload),
  },
  updates: {
    check: () => ipcRenderer.invoke(IPCChannels.updateCheck),
    download: () => ipcRenderer.invoke(IPCChannels.updateDownload),
    openDownloaded: () => ipcRenderer.invoke(IPCChannels.updateOpenDownloaded),
    revealDownloaded: () => ipcRenderer.invoke(IPCChannels.updateRevealDownloaded),
    openReleasePage: () => ipcRenderer.invoke(IPCChannels.updateOpenReleasePage),
    getStatus: () => ipcRenderer.invoke(IPCChannels.updateGetStatus),
    cancelDownload: () => ipcRenderer.invoke(IPCChannels.updateCancelDownload),
    onStatusChanged: (listener: (status: UpdateInfo) => void) => {
      const wrapped = (_: unknown, data: UpdateInfo) => listener(data);
      ipcRenderer.on(IPCChannels.updateStatusChanged, wrapped);
      return () => {
        ipcRenderer.removeListener(IPCChannels.updateStatusChanged, wrapped);
      };
    },
  },
  criticalFlow: {
    register: (flow: CriticalFlowType) =>
      ipcRenderer.invoke(IPCChannels.criticalFlowRegister, { flow }),
    unregister: (flow: CriticalFlowType) =>
      ipcRenderer.invoke(IPCChannels.criticalFlowUnregister, { flow }),
  },
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
  chain: {
    getNetworkState: () => ipcRenderer.invoke(IPCChannels.chainGetNetworkState),
    setNetwork: (payload: { activeChain: ChainId; suiEnvironment: SuiChainEnvironment }) =>
      ipcRenderer.invoke(IPCChannels.chainSetNetwork, payload),
    getBalances: (accountId: string) => ipcRenderer.invoke(IPCChannels.chainGetBalances, accountId),
    getActivity: (payload: { accountId: string; cursor?: string | null }) =>
      ipcRenderer.invoke(IPCChannels.chainGetActivity, payload),
    prepareTransfer: (payload: {
      accountId: string;
      recipient: string;
      coinType: string;
      amountDisplay: string;
    }) => ipcRenderer.invoke(IPCChannels.chainPrepareTransfer, payload),
    confirmTransfer: (payload: { transferRequestId: string }) =>
      ipcRenderer.invoke(IPCChannels.chainConfirmTransfer, payload),
    executeSwap: (payload) => ipcRenderer.invoke(IPCChannels.chainExecuteSwap, payload),
    executeNaviYield: (payload) => ipcRenderer.invoke(IPCChannels.chainExecuteNaviYield, payload),
    executeComposite: (payload) => ipcRenderer.invoke(IPCChannels.chainExecuteComposite, payload),
    executeRebalance: (payload) => ipcRenderer.invoke(IPCChannels.chainExecuteRebalance, payload),
    getDailyBriefChainBundle: (accountId: string) =>
      ipcRenderer.invoke(IPCChannels.chainGetDailyBriefBundle, accountId),
    publishDailyBriefMemory: (payload: { accountId: string; memory: DailyBriefAssistantMemoryPayload }) =>
      ipcRenderer.invoke(IPCChannels.chainPublishDailyBriefMemory, payload),
    onNetworkChanged: (listener: () => void) => {
      const channel = IPCChannels.chainNetworkChanged;
      const wrapped = () => listener();
      ipcRenderer.on(channel, wrapped);
      return () => {
        ipcRenderer.removeListener(channel, wrapped);
      };
    },
  },
  contacts: {
    list: (payload: { query?: string }) => ipcRenderer.invoke(IPCChannels.contactsList, payload ?? {}),
    create: (payload: {
      name: string;
      address: string;
      chain: ChainId;
      accountId?: string | null;
    }) => ipcRenderer.invoke(IPCChannels.contactsCreate, payload),
    update: (payload: { id: string; name: string; address: string }) =>
      ipcRenderer.invoke(IPCChannels.contactsUpdate, payload),
    delete: (payload: { id: string }) => ipcRenderer.invoke(IPCChannels.contactsDelete, payload),
  },
  llm: {
    getState: () => ipcRenderer.invoke(IPCChannels.llmGetState),
    installModel: () => ipcRenderer.invoke(IPCChannels.llmInstallModel),
    loadModel: () => ipcRenderer.invoke(IPCChannels.llmLoadModel),
    unloadModel: () => ipcRenderer.invoke(IPCChannels.llmUnloadModel),
    deleteModel: () => ipcRenderer.invoke(IPCChannels.llmDeleteModel),
    cancelDownload: () => ipcRenderer.invoke(IPCChannels.llmCancelDownload),
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
  assistantChat: {
    list: (accountId: string) => ipcRenderer.invoke(IPCChannels.assistantChatList, accountId),
    search: (payload: { accountId: string; query: string }) =>
      ipcRenderer.invoke(IPCChannels.assistantChatSearch, payload),
    create: (payload: { accountId: string; title?: string }) =>
      ipcRenderer.invoke(IPCChannels.assistantChatCreate, payload),
    get: (payload: { accountId: string; chatId: string }) =>
      ipcRenderer.invoke(IPCChannels.assistantChatGet, payload),
    rename: (payload: { accountId: string; chatId: string; title: string }) =>
      ipcRenderer.invoke(IPCChannels.assistantChatRename, payload),
    pin: (payload: { accountId: string; chatId: string }) =>
      ipcRenderer.invoke(IPCChannels.assistantChatPin, payload),
    unpin: (payload: { accountId: string; chatId: string }) =>
      ipcRenderer.invoke(IPCChannels.assistantChatUnpin, payload),
    delete: (payload: { accountId: string; chatId: string }) =>
      ipcRenderer.invoke(IPCChannels.assistantChatDelete, payload),
    messages: (payload: { accountId: string; chatId: string }) =>
      ipcRenderer.invoke(IPCChannels.assistantChatMessages, payload),
    addMessage: (payload: {
      accountId: string;
      chatId: string;
      role: string;
      content: string;
      metadata?: string | null;
    }) => ipcRenderer.invoke(IPCChannels.assistantChatAddMessage, payload),
    updateMessage: (payload: {
      accountId: string;
      chatId: string;
      messageId: string;
      content?: string;
      metadata?: string | null;
    }) => ipcRenderer.invoke(IPCChannels.assistantChatUpdateMessage, payload),
    getActive: (accountId: string) => ipcRenderer.invoke(IPCChannels.assistantChatGetActive, accountId),
    setActive: (payload: { accountId: string; chatId: string | null }) =>
      ipcRenderer.invoke(IPCChannels.assistantChatSetActive, payload),
    resolveContactDisambiguation: (payload: {
      accountId: string;
      chatId: string;
      messageId: string;
      disambiguationId: string;
      pickedMatchId: string;
    }) => ipcRenderer.invoke(IPCChannels.assistantChatResolveContactDisambiguation, payload),
  },
  nativeBrowser: {
    setViewportBounds: (payload) =>
      ipcRenderer.invoke(IPCChannels.nativeBrowserSetViewportBounds, payload),
    setVisible: (visible) => ipcRenderer.invoke(IPCChannels.nativeBrowserSetVisible, visible),
    navigate: (url) => ipcRenderer.invoke(IPCChannels.nativeBrowserNavigate, url),
    goBack: () => ipcRenderer.invoke(IPCChannels.nativeBrowserGoBack),
    goForward: () => ipcRenderer.invoke(IPCChannels.nativeBrowserGoForward),
    reload: () => ipcRenderer.invoke(IPCChannels.nativeBrowserReload),
    resolveWalletRequest: (payload) =>
      ipcRenderer.invoke(IPCChannels.nativeBrowserResolveWalletRequest, payload),
    persistAuthorizedAccounts: (payload) =>
      ipcRenderer.invoke(IPCChannels.nativeBrowserPersistAuthorizedAccounts, payload),
    clearAuthorizedAccounts: (payload) =>
      ipcRenderer.invoke(IPCChannels.nativeBrowserClearAuthorizedAccounts, payload),
    onDidNavigate: (listener) => {
      const wrapped = (_: unknown, data: { url: string }) => listener(data);
      ipcRenderer.on(IPCChannels.nativeBrowserDidNavigate, wrapped);
      return () => ipcRenderer.removeListener(IPCChannels.nativeBrowserDidNavigate, wrapped);
    },
    onLoadingState: (listener) => {
      const wrapped = (_: unknown, data: { isLoading: boolean }) => listener(data);
      ipcRenderer.on(IPCChannels.nativeBrowserLoadingState, wrapped);
      return () => ipcRenderer.removeListener(IPCChannels.nativeBrowserLoadingState, wrapped);
    },
    onWalletRequest: (listener) => {
      const wrapped = (_: unknown, data: import("./browser/types/browser.types").DestrallWalletBridgeRequest) =>
        listener(data);
      ipcRenderer.on(IPCChannels.nativeBrowserWalletRequest, wrapped);
      return () => ipcRenderer.removeListener(IPCChannels.nativeBrowserWalletRequest, wrapped);
    },
    onRequestBoundsSync: (listener) => {
      const wrapped = () => listener();
      ipcRenderer.on(IPCChannels.nativeBrowserRequestBoundsSync, wrapped);
      return () => ipcRenderer.removeListener(IPCChannels.nativeBrowserRequestBoundsSync, wrapped);
    },
  },
  browser: {
    getState: (accountId) => ipcRenderer.invoke(IPCChannels.browserGetState, { accountId }),
    replaceState: (payload) => ipcRenderer.invoke(IPCChannels.browserReplaceState, payload),
    authorizeDapp: (payload) => ipcRenderer.invoke(IPCChannels.browserAuthorizeDapp, payload),
  },
  browserWallet: {
    connect: (payload) => ipcRenderer.invoke(IPCChannels.browserWalletConnect, payload),
    disconnect: (payload) => ipcRenderer.invoke(IPCChannels.browserWalletDisconnect, payload),
    signPersonalMessage: (payload) =>
      ipcRenderer.invoke(IPCChannels.browserWalletSignPersonalMessage, payload),
    signTransaction: (payload) => ipcRenderer.invoke(IPCChannels.browserWalletSignTransaction, payload),
    signAndExecuteTransaction: (payload) =>
      ipcRenderer.invoke(IPCChannels.browserWalletSignAndExecute, payload),
    previewTransaction: (payload) =>
      ipcRenderer.invoke(IPCChannels.browserPreviewTransaction, payload),
  },
  triggers: {
    list: (accountId: string) => ipcRenderer.invoke(IPCChannels.triggersList, { accountId }),
    approve: (payload: { accountId: string; proposalSnapshot: import("./packages/core/triggers/triggers.types").TriggerProposalSnapshotV1 }) =>
      ipcRenderer.invoke(IPCChannels.triggersApprove, payload),
    pause: (payload: { accountId: string; triggerId: string }) =>
      ipcRenderer.invoke(IPCChannels.triggersPause, payload),
    resume: (payload: { accountId: string; triggerId: string }) =>
      ipcRenderer.invoke(IPCChannels.triggersResume, payload),
    delete: (payload: { accountId: string; triggerId: string }) =>
      ipcRenderer.invoke(IPCChannels.triggersDelete, payload),
    executions: (payload: { accountId: string; triggerId: string }) =>
      ipcRenderer.invoke(IPCChannels.triggersExecutions, payload),
  },
};

contextBridge.exposeInMainWorld("destrallApi", api);
