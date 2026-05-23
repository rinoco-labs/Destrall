import type { AssistantChatRow, AssistantMessageRow } from "./assistantChat";
import type { WalletAccount, WalletStatusSnapshot, ChainId } from "./wallet/types";
import type {
  ChainActivityPage,
  NetworkUiSnapshot,
  SwapExecuteResult,
  TokenBalanceView,
  TransferExecuteResult,
  TransferPrepareResult,
} from "../types/blockchain";
import type { SuiChainEnvironment } from "../config/chains/sui";
import type { SupportedChainDescriptor } from "../config/networks";
import type { SwapProposalSnapshotV1 } from "@packages/core/swap/swap.types";
import type { NaviPoolRow, NaviPositionView, NaviYieldProposalSnapshotV1 } from "@packages/core/yield/navi/navi.types";
import type { YieldRiskProfile } from "@packages/core/yield/navi/navi-risk.heuristics";
import type { DailyBriefAssistantMemoryPayload } from "./dailyBriefMemory";
import type { TriggerExecutionRecord, TriggerRecord } from "@packages/core/triggers/triggers.types";
import type { TriggerProposalSnapshotV1 } from "@packages/core/triggers/triggers.types";
import type {
  BrowserPersistedState,
  DestrallWalletBridgeRequest,
  NativeBrowserViewportBounds,
} from "../browser/types/browser.types";
import type {
  SuiSignAndExecuteResult,
  SuiSignPersonalMessageResult,
  SuiSignTransactionResult,
  WalletStandardConnectResult,
} from "../browser/types/walletStandard.types";

export type RpcResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Navi pools, positions, and stored yield risk for on-device Daily Brief (main-backed reads). */
export type DailyBriefChainBundle = {
  pools: NaviPoolRow[];
  positions: NaviPositionView[];
  riskProfile: YieldRiskProfile;
};

export type WalletCreateRequest = {
  mnemonic: string;
  password: string;
  profileName?: string;
  accountName?: string;
  imported?: boolean;
  termsAccepted: true;
};

export type LlmInstallStatus =
  | "not_installed"
  | "downloading"
  | "installed"
  | "selected"
  | "failed"
  | "invalid";

/** Install / disk metadata for the single built-in assistant model (no vendor names in UI). */
export type AssistantAiModelState = {
  installed: boolean;
  status: LlmInstallStatus;
  localPath: string | null;
  downloadProgress: number | null;
  errorMessage: string | null;
  installedAt: number | null;
  updatedAt: number | null;
};

export type LlmStateSnapshot = {
  model: AssistantAiModelState;
};

export type AssistantRuntimeState = {
  status: "idle" | "loading" | "ready" | "failed";
  errorMessage: string | null;
};

export type ModelProgressEvent = {
  progress: number;
  status: "downloading" | "loading" | "ready" | "failed";
  message: string;
};

export type AssistantChatTurn = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AssistantChatRequest = {
  messages: AssistantChatTurn[];
  accountId: string;
  /** Active assistant thread — used for follow-up context (e.g. “that pool”). */
  chatId?: string;
  language: string;
  personalityId: string;
  /** Optional summary of pending proposal cards in the active chat (non-secret). */
  pendingProposalsSummary?: string;
};

/** LLM reply plus optional structured UI blocks (JSON metadata for assistant_messages). */
export type AssistantChatResponse = {
  content: string;
  metadata?: string | null;
};

export type ContactRow = {
  id: string;
  accountId: string | null;
  name: string;
  address: string;
  chain: ChainId;
  createdAt: number;
  updatedAt: number;
};

export type ChainNetworkStatePayload = NetworkUiSnapshot & {
  supportedChains: SupportedChainDescriptor[];
};

export type DestrallApi = {
  app: {
    openExternalUrl: (payload: { url: string }) => Promise<RpcResult<{ ok: true }>>;
  };
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
  chain: {
    getNetworkState: () => Promise<RpcResult<ChainNetworkStatePayload>>;
    setNetwork: (payload: {
      activeChain: ChainId;
      suiEnvironment: SuiChainEnvironment;
    }) => Promise<RpcResult<ChainNetworkStatePayload>>;
    getBalances: (accountId: string) => Promise<RpcResult<TokenBalanceView[]>>;
    getActivity: (payload: {
      accountId: string;
      cursor?: string | null;
    }) => Promise<RpcResult<ChainActivityPage>>;
    prepareTransfer: (payload: {
      accountId: string;
      recipient: string;
      coinType: string;
      amountDisplay: string;
    }) => Promise<RpcResult<TransferPrepareResult>>;
    confirmTransfer: (payload: {
      transferRequestId: string;
    }) => Promise<RpcResult<TransferExecuteResult>>;
    executeSwap: (payload: {
      accountId: string;
      proposalSnapshot: SwapProposalSnapshotV1;
    }) => Promise<RpcResult<SwapExecuteResult>>;
    executeNaviYield: (payload: {
      accountId: string;
      proposalSnapshot: NaviYieldProposalSnapshotV1;
    }) => Promise<RpcResult<SwapExecuteResult>>;
    executeComposite: (payload: {
      accountId: string;
      proposalSnapshot: import("@packages/runtime/composite/compositeTypes").CompositeProposalSnapshotV1;
    }) => Promise<RpcResult<SwapExecuteResult>>;
    executeRebalance: (payload: {
      accountId: string;
      proposalSnapshot: import("@packages/core/rebalance/rebalance.types").RebalanceProposalSnapshotV1;
    }) => Promise<RpcResult<SwapExecuteResult>>;
    getDailyBriefChainBundle: (accountId: string) => Promise<RpcResult<DailyBriefChainBundle>>;
    publishDailyBriefMemory: (payload: {
      accountId: string;
      memory: DailyBriefAssistantMemoryPayload;
    }) => Promise<RpcResult<{ ok: true }>>;
    onNetworkChanged: (listener: () => void) => () => void;
  };
  contacts: {
    list: (payload: { query?: string }) => Promise<RpcResult<ContactRow[]>>;
    create: (payload: {
      name: string;
      address: string;
      chain: ChainId;
      accountId?: string | null;
    }) => Promise<RpcResult<ContactRow>>;
    update: (payload: { id: string; name: string; address: string }) => Promise<RpcResult<ContactRow>>;
    delete: (payload: { id: string }) => Promise<RpcResult<{ ok: true }>>;
  };
  llm: {
    getState: () => Promise<RpcResult<LlmStateSnapshot>>;
    installModel: () => Promise<RpcResult<LlmStateSnapshot>>;
    loadModel: () => Promise<RpcResult<LlmStateSnapshot>>;
    unloadModel: () => Promise<RpcResult<LlmStateSnapshot>>;
    deleteModel: () => Promise<RpcResult<LlmStateSnapshot>>;
    cancelDownload: () => Promise<RpcResult<{ ok: true }>>;
    assistantRuntime: () => Promise<RpcResult<AssistantRuntimeState>>;
    chat: (payload: AssistantChatRequest) => Promise<RpcResult<AssistantChatResponse>>;
    onModelProgress: (listener: (event: ModelProgressEvent) => void) => () => void;
  };
  assistantChat: {
    list: (accountId: string) => Promise<RpcResult<AssistantChatRow[]>>;
    search: (payload: { accountId: string; query: string }) => Promise<RpcResult<AssistantChatRow[]>>;
    create: (payload: { accountId: string; title?: string }) => Promise<RpcResult<AssistantChatRow>>;
    get: (payload: { accountId: string; chatId: string }) => Promise<RpcResult<AssistantChatRow>>;
    rename: (payload: { accountId: string; chatId: string; title: string }) => Promise<RpcResult<AssistantChatRow>>;
    pin: (payload: { accountId: string; chatId: string }) => Promise<RpcResult<AssistantChatRow>>;
    unpin: (payload: { accountId: string; chatId: string }) => Promise<RpcResult<AssistantChatRow>>;
    delete: (payload: { accountId: string; chatId: string }) => Promise<RpcResult<{ ok: true }>>;
    messages: (payload: { accountId: string; chatId: string }) => Promise<RpcResult<AssistantMessageRow[]>>;
    addMessage: (payload: {
      accountId: string;
      chatId: string;
      role: string;
      content: string;
      metadata?: string | null;
    }) => Promise<RpcResult<AssistantMessageRow>>;
    updateMessage: (payload: {
      accountId: string;
      chatId: string;
      messageId: string;
      content?: string;
      metadata?: string | null;
    }) => Promise<RpcResult<AssistantMessageRow>>;
    getActive: (accountId: string) => Promise<RpcResult<string | null>>;
    setActive: (payload: { accountId: string; chatId: string | null }) => Promise<RpcResult<{ ok: true }>>;
    resolveContactDisambiguation: (payload: {
      accountId: string;
      chatId: string;
      messageId: string;
      disambiguationId: string;
      pickedMatchId: string;
    }) => Promise<RpcResult<AssistantMessageRow>>;
  };
  nativeBrowser: {
    setViewportBounds: (payload: NativeBrowserViewportBounds) => Promise<RpcResult<{ ok: true }>>;
    setVisible: (visible: boolean) => Promise<RpcResult<{ ok: true }>>;
    navigate: (url: string) => Promise<RpcResult<{ ok: true }>>;
    goBack: () => Promise<RpcResult<{ ok: true }>>;
    goForward: () => Promise<RpcResult<{ ok: true }>>;
    reload: () => Promise<RpcResult<{ ok: true }>>;
    resolveWalletRequest: (payload: {
      id: string;
      result?: unknown;
      error?: string;
    }) => Promise<RpcResult<{ ok: true }>>;
    persistAuthorizedAccounts: (payload: {
      origin: string;
      chain: "sui" | "solana";
      accounts: WalletStandardConnectResult["accounts"];
    }) => Promise<RpcResult<{ ok: true }>>;
    clearAuthorizedAccounts: (payload: { origin: string }) => Promise<RpcResult<{ ok: true }>>;
    onDidNavigate: (listener: (payload: { url: string }) => void) => () => void;
    onLoadingState: (listener: (payload: { isLoading: boolean }) => void) => () => void;
    onWalletRequest: (listener: (payload: DestrallWalletBridgeRequest) => void) => () => void;
    onRequestBoundsSync: (listener: () => void) => () => void;
  };
  browser: {
    getState: (accountId: string) => Promise<RpcResult<BrowserPersistedState>>;
    replaceState: (payload: {
      accountId: string;
      state: BrowserPersistedState;
    }) => Promise<RpcResult<BrowserPersistedState>>;
    authorizeDapp: (payload: {
      accountId: string;
      origin: string;
      displayName: string;
      accountAddress: string;
      network: string;
      permissions: ("viewAccount" | "signMessage" | "signTransaction" | "executeTransaction")[];
    }) => Promise<RpcResult<BrowserPersistedState>>;
  };
  browserWallet: {
    connect: (payload: {
      accountId: string;
      origin: string;
      chain: "sui" | "solana";
      silent?: boolean;
    }) => Promise<RpcResult<WalletStandardConnectResult>>;
    disconnect: (payload: {
      accountId: string;
      origin: string;
      chain: "sui" | "solana";
    }) => Promise<RpcResult<{ ok: true }>>;
    signPersonalMessage: (payload: {
      accountId: string;
      origin: string;
      messageBase64: string;
    }) => Promise<RpcResult<SuiSignPersonalMessageResult>>;
    signTransaction: (payload: {
      accountId: string;
      origin: string;
      txDataJson: string;
    }) => Promise<RpcResult<SuiSignTransactionResult>>;
    signAndExecuteTransaction: (payload: {
      accountId: string;
      origin: string;
      txDataJson: string;
    }) => Promise<RpcResult<SuiSignAndExecuteResult>>;
    previewTransaction: (payload: {
      accountId: string;
      txDataJson: string;
    }) => Promise<
      RpcResult<{
        ok: boolean;
        gasEstimate?: string;
        errorMessage?: string;
        balanceChanges?: { coinType: string; amount: string; owner?: string }[];
      }>
    >;
  };
  triggers: {
    list: (accountId: string) => Promise<RpcResult<TriggerRecord[]>>;
    approve: (payload: {
      accountId: string;
      proposalSnapshot: TriggerProposalSnapshotV1;
    }) => Promise<RpcResult<TriggerRecord>>;
    pause: (payload: { accountId: string; triggerId: string }) => Promise<RpcResult<TriggerRecord>>;
    resume: (payload: { accountId: string; triggerId: string }) => Promise<RpcResult<TriggerRecord>>;
    delete: (payload: { accountId: string; triggerId: string }) => Promise<RpcResult<TriggerRecord>>;
    executions: (payload: {
      accountId: string;
      triggerId: string;
    }) => Promise<RpcResult<TriggerExecutionRecord[]>>;
  };
};

export const IPCChannels = {
  appOpenExternalUrl: "app:open-external-url",
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
  chainGetNetworkState: "chain:get-network-state",
  chainSetNetwork: "chain:set-network",
  chainGetBalances: "chain:get-balances",
  chainGetActivity: "chain:get-activity",
  chainPrepareTransfer: "chain:prepare-transfer",
  chainConfirmTransfer: "chain:confirm-transfer",
  chainExecuteSwap: "chain:execute-swap",
  chainExecuteNaviYield: "chain:execute-navi-yield",
  chainExecuteComposite: "chain:execute-composite",
  chainExecuteRebalance: "chain:execute-rebalance",
  chainGetDailyBriefBundle: "chain:get-daily-brief-bundle",
  chainPublishDailyBriefMemory: "chain:publish-daily-brief-memory",
  chainNetworkChanged: "chain:network-changed",
  contactsList: "contacts:list",
  contactsCreate: "contacts:create",
  contactsUpdate: "contacts:update",
  contactsDelete: "contacts:delete",
  llmGetState: "llm:get-state",
  llmInstallModel: "llm:install-model",
  llmLoadModel: "llm:load-model",
  llmUnloadModel: "llm:unload-model",
  llmDeleteModel: "llm:delete-model",
  llmCancelDownload: "llm:cancel-download",
  llmAssistantRuntime: "llm:assistant-runtime",
  llmChat: "llm:chat",
  llmModelProgress: "llm:model-progress",
  assistantChatList: "assistant-chat:list",
  assistantChatSearch: "assistant-chat:search",
  assistantChatCreate: "assistant-chat:create",
  assistantChatGet: "assistant-chat:get",
  assistantChatRename: "assistant-chat:rename",
  assistantChatPin: "assistant-chat:pin",
  assistantChatUnpin: "assistant-chat:unpin",
  assistantChatDelete: "assistant-chat:delete",
  assistantChatMessages: "assistant-chat:messages",
    assistantChatAddMessage: "assistant-chat:add-message",
    assistantChatUpdateMessage: "assistant-chat:update-message",
  assistantChatGetActive: "assistant-chat:get-active",
  assistantChatSetActive: "assistant-chat:set-active",
  assistantChatResolveContactDisambiguation: "assistant-chat:resolve-contact-disambiguation",
  nativeBrowserSetViewportBounds: "native-browser:set-viewport-bounds",
  nativeBrowserSetVisible: "native-browser:set-visible",
  nativeBrowserNavigate: "native-browser:navigate",
  nativeBrowserGoBack: "native-browser:go-back",
  nativeBrowserGoForward: "native-browser:go-forward",
  nativeBrowserReload: "native-browser:reload",
  nativeBrowserResolveWalletRequest: "native-browser:resolve-wallet-request",
  nativeBrowserPersistAuthorizedAccounts: "native-browser:persist-authorized-accounts",
  nativeBrowserClearAuthorizedAccounts: "native-browser:clear-authorized-accounts",
  nativeBrowserDidNavigate: "native-browser:did-navigate",
  nativeBrowserLoadingState: "native-browser:loading-state",
  nativeBrowserWalletRequest: "native-browser:wallet-request",
  nativeBrowserWalletResponse: "native-browser:wallet-response",
  nativeBrowserRequestBoundsSync: "native-browser:request-bounds-sync",
  browserGetState: "browser:get-state",
  browserReplaceState: "browser:replace-state",
  browserAuthorizeDapp: "browser:authorize-dapp",
  browserWalletConnect: "browser-wallet:connect",
  browserWalletDisconnect: "browser-wallet:disconnect",
  browserWalletSignPersonalMessage: "browser-wallet:sign-personal-message",
  browserWalletSignTransaction: "browser-wallet:sign-transaction",
  browserWalletSignAndExecute: "browser-wallet:sign-and-execute",
  browserPreviewTransaction: "browser-wallet:preview-transaction",
  triggersList: "triggers:list",
  triggersApprove: "triggers:approve",
  triggersPause: "triggers:pause",
  triggersResume: "triggers:resume",
  triggersDelete: "triggers:delete",
  triggersExecutions: "triggers:executions",
} as const;
