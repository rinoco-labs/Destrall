import type { RpcResult } from "../../shared/ipc";
import type {
  BrowserPersistedState,
  DestrallWalletBridgeRequest,
  NativeBrowserViewportBounds,
} from "../../browser/types/browser.types";
import type {
  SuiSignAndExecuteResult,
  SuiSignPersonalMessageResult,
  SuiSignTransactionResult,
  WalletStandardConnectResult,
} from "../../browser/types/walletStandard.types";

function api() {
  if (typeof window === "undefined" || !window.destrallApi) {
    throw new Error("Destrall desktop API is not available");
  }
  const { nativeBrowser, browser, browserWallet } = window.destrallApi;
  if (!nativeBrowser || !browser || !browserWallet) {
    throw new Error("Browser APIs are not available. Restart the app to load the latest build.");
  }
  return { nativeBrowser, browser, browserWallet };
}

async function unwrap<T>(result: Promise<RpcResult<T>>): Promise<T> {
  const response = await result;
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.data;
}

export async function desktopNativeBrowserSetViewportBounds(bounds: NativeBrowserViewportBounds) {
  const { nativeBrowser } = api();
  return unwrap(nativeBrowser.setViewportBounds(bounds));
}

export async function desktopNativeBrowserSetVisible(visible: boolean) {
  const { nativeBrowser } = api();
  return unwrap(nativeBrowser.setVisible(visible));
}

export async function desktopNativeBrowserNavigate(url: string) {
  const { nativeBrowser } = api();
  return unwrap(nativeBrowser.navigate(url));
}

export async function desktopNativeBrowserGoBack() {
  const { nativeBrowser } = api();
  return unwrap(nativeBrowser.goBack());
}

export async function desktopNativeBrowserGoForward() {
  const { nativeBrowser } = api();
  return unwrap(nativeBrowser.goForward());
}

export async function desktopNativeBrowserReload() {
  const { nativeBrowser } = api();
  return unwrap(nativeBrowser.reload());
}

export async function desktopNativeBrowserResolveWalletRequest(payload: {
  id: string;
  result?: unknown;
  error?: string;
}) {
  const { nativeBrowser } = api();
  return unwrap(nativeBrowser.resolveWalletRequest(payload));
}

export async function desktopNativeBrowserPersistAuthorizedAccounts(payload: {
  origin: string;
  chain: "sui" | "solana";
  accounts: WalletStandardConnectResult["accounts"];
}) {
  const { nativeBrowser } = api();
  return unwrap(nativeBrowser.persistAuthorizedAccounts(payload));
}

export async function desktopNativeBrowserClearAuthorizedAccounts(origin: string) {
  const { nativeBrowser } = api();
  return unwrap(nativeBrowser.clearAuthorizedAccounts({ origin }));
}

export async function desktopBrowserGetState(accountId: string) {
  const { browser } = api();
  return unwrap(browser.getState(accountId));
}

export async function desktopBrowserReplaceState(accountId: string, state: BrowserPersistedState) {
  const { browser } = api();
  return unwrap(browser.replaceState({ accountId, state }));
}

export async function desktopBrowserAuthorizeDapp(payload: {
  accountId: string;
  origin: string;
  displayName: string;
  accountAddress: string;
  network: string;
  permissions: ("viewAccount" | "signMessage" | "signTransaction" | "executeTransaction")[];
}) {
  const { browser } = api();
  return unwrap(browser.authorizeDapp(payload));
}

export async function desktopBrowserWalletConnect(payload: {
  accountId: string;
  origin: string;
  chain: "sui" | "solana";
  silent?: boolean;
}) {
  const { browserWallet } = api();
  return unwrap(browserWallet.connect(payload));
}

export async function desktopBrowserWalletDisconnect(payload: {
  accountId: string;
  origin: string;
  chain: "sui" | "solana";
}) {
  const { browserWallet } = api();
  return unwrap(browserWallet.disconnect(payload));
}

export async function desktopBrowserWalletSignPersonalMessage(payload: {
  accountId: string;
  origin: string;
  messageBase64: string;
}) {
  const { browserWallet } = api();
  return unwrap(browserWallet.signPersonalMessage(payload));
}

export async function desktopBrowserWalletSignTransaction(payload: {
  accountId: string;
  origin: string;
  txDataJson: string;
}) {
  const { browserWallet } = api();
  return unwrap(browserWallet.signTransaction(payload));
}

export async function desktopBrowserWalletSignAndExecute(payload: {
  accountId: string;
  origin: string;
  txDataJson: string;
}) {
  const { browserWallet } = api();
  return unwrap(browserWallet.signAndExecuteTransaction(payload));
}

export async function desktopBrowserPreviewTransaction(payload: {
  accountId: string;
  txDataJson: string;
}) {
  const { browserWallet } = api();
  return unwrap(browserWallet.previewTransaction(payload));
}

export function subscribeNativeBrowserDidNavigate(listener: (url: string) => void) {
  const { nativeBrowser } = api();
  return nativeBrowser.onDidNavigate(({ url }: { url: string }) => listener(url));
}

export function subscribeNativeBrowserLoading(listener: (isLoading: boolean) => void) {
  const { nativeBrowser } = api();
  return nativeBrowser.onLoadingState(({ isLoading }: { isLoading: boolean }) => listener(isLoading));
}

export function subscribeNativeBrowserWalletRequest(
  listener: (request: DestrallWalletBridgeRequest) => void,
) {
  const { nativeBrowser } = api();
  return nativeBrowser.onWalletRequest(listener);
}

export function subscribeNativeBrowserRequestBoundsSync(listener: () => void) {
  const { nativeBrowser } = api();
  return nativeBrowser.onRequestBoundsSync(listener);
}
