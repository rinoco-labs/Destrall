export type BrowserChainId = "sui" | "solana";

export type DappPermission =
  | "viewAccount"
  | "signMessage"
  | "signTransaction"
  | "executeTransaction";

export type ConnectedDappRecord = {
  origin: string;
  displayName: string;
  favicon: string;
  accounts: string[];
  network: string;
  permissions: DappPermission[];
  status: "connected" | "disconnected";
  firstConnected: number;
  lastUsed: number;
};

export type BrowserTab = {
  id: string;
  url: string;
  title: string;
  favicon: string;
  navHistory: string[];
  navIndex: number;
};

export type BrowserHistoryItem = {
  id: string;
  url: string;
  title: string;
  domain: string;
  timestamp: number;
};

export type BrowserPersistedState = {
  tabs: BrowserTab[];
  activeTabId: string;
  history: BrowserHistoryItem[];
  connectedDapps: ConnectedDappRecord[];
};

export type NativeBrowserViewportBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DestrallWalletBridgeRequest = {
  type: "destrall-wallet-request";
  id: string;
  method: string;
  payload?: unknown;
  origin: string;
  timestamp?: number;
};

export type DestrallWalletBridgeResponse = {
  id: string;
  result?: unknown;
  error?: string;
};

export const EMPTY_BROWSER_STATE: BrowserPersistedState = {
  tabs: [],
  activeTabId: "",
  history: [],
  connectedDapps: [],
};
