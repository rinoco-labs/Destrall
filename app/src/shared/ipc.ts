import type { ModelCatalogEntry } from "../ai/modelCatalog";
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
import type { NaviYieldProposalSnapshotV1 } from "@packages/core/yield/navi/navi.types";

export type RpcResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type WalletCreateRequest = {
  mnemonic: string;
  password: string;
  profileName?: string;
  accountName?: string;
  imported?: boolean;
};

export type LlmInstallStatus =
  | "not_installed"
  | "downloading"
  | "installed"
  | "selected"
  | "failed"
  | "invalid";

export type LlmModelView = ModelCatalogEntry & {
  installed: boolean;
  selected: boolean;
  status: LlmInstallStatus;
  localPath: string | null;
  fileName: string | null;
  downloadProgress: number | null;
  errorMessage: string | null;
  installedAt: number | null;
  updatedAt: number | null;
};

export type LlmStateSnapshot = {
  models: LlmModelView[];
  selectedModelId: string | null;
};

export type AssistantRuntimeState = {
  selectedModelId: string | null;
  status: "idle" | "loading" | "ready" | "failed";
  errorMessage: string | null;
};

export type ModelProgressEvent = {
  modelId: string;
  progress: number;
  status: "downloading" | "ready" | "failed";
  message: string;
};

export type AssistantChatTurn = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AssistantChatRequest = {
  messages: AssistantChatTurn[];
  accountId: string;
  language: string;
  personalityId: string;
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
    installModel: (modelId: string) => Promise<RpcResult<LlmStateSnapshot>>;
    selectModel: (modelId: string) => Promise<RpcResult<LlmStateSnapshot>>;
    unloadModel: () => Promise<RpcResult<LlmStateSnapshot>>;
    deleteModel: (modelId: string) => Promise<RpcResult<LlmStateSnapshot>>;
    cancelDownload: (modelId: string) => Promise<RpcResult<{ ok: true }>>;
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
  chainGetNetworkState: "chain:get-network-state",
  chainSetNetwork: "chain:set-network",
  chainGetBalances: "chain:get-balances",
  chainGetActivity: "chain:get-activity",
  chainPrepareTransfer: "chain:prepare-transfer",
  chainConfirmTransfer: "chain:confirm-transfer",
  chainExecuteSwap: "chain:execute-swap",
  chainExecuteNaviYield: "chain:execute-navi-yield",
  chainNetworkChanged: "chain:network-changed",
  contactsList: "contacts:list",
  contactsCreate: "contacts:create",
  contactsUpdate: "contacts:update",
  contactsDelete: "contacts:delete",
  llmGetState: "llm:get-state",
  llmInstallModel: "llm:install-model",
  llmSelectModel: "llm:select-model",
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
} as const;
