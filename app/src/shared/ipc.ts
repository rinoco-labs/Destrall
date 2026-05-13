import type { ModelCatalogEntry } from "../ai/modelCatalog";
import type { WalletAccount, WalletStatusSnapshot } from "./wallet/types";

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
  llm: {
    getState: () => Promise<RpcResult<LlmStateSnapshot>>;
    installModel: (modelId: string) => Promise<RpcResult<LlmStateSnapshot>>;
    selectModel: (modelId: string) => Promise<RpcResult<LlmStateSnapshot>>;
    unloadModel: () => Promise<RpcResult<LlmStateSnapshot>>;
    deleteModel: (modelId: string) => Promise<RpcResult<LlmStateSnapshot>>;
    cancelDownload: (modelId: string) => Promise<RpcResult<{ ok: true }>>;
    assistantRuntime: () => Promise<RpcResult<AssistantRuntimeState>>;
    chat: (payload: AssistantChatRequest) => Promise<RpcResult<string>>;
    onModelProgress: (listener: (event: ModelProgressEvent) => void) => () => void;
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
  llmGetState: "llm:get-state",
  llmInstallModel: "llm:install-model",
  llmSelectModel: "llm:select-model",
  llmUnloadModel: "llm:unload-model",
  llmDeleteModel: "llm:delete-model",
  llmCancelDownload: "llm:cancel-download",
  llmAssistantRuntime: "llm:assistant-runtime",
  llmChat: "llm:chat",
  llmModelProgress: "llm:model-progress",
} as const;
