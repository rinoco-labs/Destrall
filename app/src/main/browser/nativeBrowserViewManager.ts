import { BrowserView, BrowserWindow, WebContentsView, ipcMain } from "electron";
import { buildWalletStandardInjectionForNetwork } from "../../browser/injections/injectionBuilder";
import { IPCChannels } from "../../shared/ipc";
import type { DestrallWalletBridgeRequest } from "../../browser/types/browser.types";
import { criticalFlowService } from "../services/security/criticalFlowService";
import { networkSettingsService } from "../services/network/networkSettingsService";
import { clearSuiClientCache } from "../services/chains/sui/sui-client.service";

type NativeViewHandle =
  | { kind: "webContentsView"; view: WebContentsView; webContents: Electron.WebContents }
  | { kind: "browserView"; view: BrowserView; webContents: Electron.WebContents };

export class NativeBrowserViewManager {
  static readonly LOG_PREFIX = "[destrall:native-browser]";

  private readonly window: BrowserWindow;
  private readonly guestPreloadPath: string;
  private nativeView: NativeViewHandle | null = null;
  private visible = false;
  private latestBounds = { x: 0, y: 0, width: 0, height: 0 };
  private currentUrl = "";
  private readonly walletRequestChannel = "native-browser:wallet-request";
  private readonly walletResponseChannel = IPCChannels.nativeBrowserWalletResponse;
  private readonly walletResponseResolver = "window.__destrallResolveWalletRequest";

  private readonly handleWalletRequest = (
    event: Electron.IpcMainEvent,
    payload: DestrallWalletBridgeRequest,
  ) => {
    if (!payload || payload.type !== "destrall-wallet-request" || !payload.id) return;

    const guest = this.nativeView?.webContents;
    if (guest && event.sender.id !== guest.id) {
      console.warn(
        NativeBrowserViewManager.LOG_PREFIX,
        "ignored wallet request from unexpected sender",
        event.sender.id,
      );
      return;
    }

    console.debug(
      NativeBrowserViewManager.LOG_PREFIX,
      "wallet request",
      payload.id,
      payload.method,
      payload.origin,
    );
    // Only hide for signing — not connect. Dapps fire silent connect on load; hiding here
    // leaves the WebContentsView invisible when connect resolves without a pending modal.
    const hideForSigning =
      payload.method === "sui:signPersonalMessage" ||
      payload.method === "sui:signTransaction" ||
      payload.method === "sui:signAndExecuteTransaction";
    if (hideForSigning && this.nativeView) {
      this.setVisible(false);
    }
    criticalFlowService.register("browser_dapp_request");
    this.window.webContents.send(IPCChannels.nativeBrowserWalletRequest, payload);
  };

  constructor(window: BrowserWindow, guestPreloadPath: string) {
    this.window = window;
    this.guestPreloadPath = guestPreloadPath;
    ipcMain.on(this.walletRequestChannel, this.handleWalletRequest);
    this.window.on("closed", () => this.destroy());
  }

  ensureCreated(): NativeViewHandle {
    if (this.nativeView) return this.nativeView;

    const webPreferences = {
      preload: this.resolveGuestPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    };

    if (typeof WebContentsView !== "undefined") {
      const view = new WebContentsView({ webPreferences });
      this.window.contentView.addChildView(view);
      this.nativeView = { kind: "webContentsView", view, webContents: view.webContents };
    } else {
      const view = new BrowserView({ webPreferences });
      this.window.setBrowserView(view);
      this.nativeView = { kind: "browserView", view, webContents: view.webContents };
    }

    const { webContents } = this.nativeView;
    webContents.setBackgroundThrottling(false);

    webContents.on("did-navigate", (_event, url) => {
      this.currentUrl = url;
      this.window.webContents.send(IPCChannels.nativeBrowserDidNavigate, { url });
    });
    webContents.on("did-navigate-in-page", (_event, url) => {
      this.currentUrl = url;
      this.window.webContents.send(IPCChannels.nativeBrowserDidNavigate, { url });
    });
    webContents.on("did-start-loading", () => {
      this.window.webContents.send(IPCChannels.nativeBrowserLoadingState, { isLoading: true });
    });
    webContents.on("did-stop-loading", () => {
      this.window.webContents.send(IPCChannels.nativeBrowserLoadingState, { isLoading: false });
    });
    webContents.on("dom-ready", () => {
      void this.injectWalletStandardScript("dom-ready");
    });
    webContents.on("did-frame-finish-load", (_event, isMainFrame) => {
      if (!isMainFrame) return;
      void this.injectWalletStandardScript("did-frame-finish-load");
    });

    this.raiseToFront();
    this.applyBounds();
    this.setVisible(this.visible);
    return this.nativeView;
  }

  navigate(url: string) {
    const view = this.ensureCreated();
    if (!url || url === this.currentUrl) return;
    this.currentUrl = url;
    void view.webContents.loadURL(url);
  }

  goBack() {
    const view = this.ensureCreated();
    if (view.webContents.navigationHistory.canGoBack()) {
      view.webContents.navigationHistory.goBack();
    }
  }

  goForward() {
    const view = this.ensureCreated();
    if (view.webContents.navigationHistory.canGoForward()) {
      view.webContents.navigationHistory.goForward();
    }
  }

  reload() {
    this.ensureCreated().webContents.reload();
  }

  setViewportBounds(bounds: { x: number; y: number; width: number; height: number }) {
    this.latestBounds = {
      x: Math.max(0, Math.round(bounds.x)),
      y: Math.max(0, Math.round(bounds.y)),
      width: Math.max(0, Math.round(bounds.width)),
      height: Math.max(0, Math.round(bounds.height)),
    };
    this.applyBounds();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    if (visible) this.ensureCreated();
    if (!this.nativeView) return;

    if (this.nativeView.kind === "webContentsView") {
      this.nativeView.view.setVisible(visible);
      if (!visible) {
        this.nativeView.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      }
    }
    if (!visible && this.nativeView.kind === "browserView") {
      this.nativeView.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
    if (visible) {
      this.raiseToFront();
      this.applyBounds();
    }
  }

  reapplyBounds() {
    this.applyBounds();
  }

  async resolveWalletRequest(id: string, result?: unknown, error?: string): Promise<void> {
    const view = this.nativeView;
    if (!view) {
      console.warn(NativeBrowserViewManager.LOG_PREFIX, "wallet resolve skipped — no guest view", id);
      return;
    }

    const message = { id, result, error };
    view.webContents.send(this.walletResponseChannel, message);

    const payload = JSON.stringify(message, (_key, value) =>
      value instanceof Uint8Array ? Array.from(value) : value,
    );
    try {
      await view.webContents.executeJavaScript(
        `${this.walletResponseResolver} && ${this.walletResponseResolver}(${payload});`,
        true,
      );
    } catch (resolveError) {
      console.warn(
        NativeBrowserViewManager.LOG_PREFIX,
        "wallet resolve executeJavaScript failed (IPC fallback used)",
        id,
        resolveError instanceof Error ? resolveError.message : String(resolveError),
      );
    }

    if (error) {
      console.warn(NativeBrowserViewManager.LOG_PREFIX, "wallet resolve error", id, error);
    }
    criticalFlowService.unregister("browser_dapp_request");
  }

  persistAuthorizedAccounts(
    origin: string,
    chain: string,
    accounts: { address: string; publicKey: number[]; chains: string[]; features: string[] }[],
  ) {
    const view = this.nativeView;
    if (!view) return;
    const key = `destrall:accounts:${origin}:${chain}`;
    const payload = JSON.stringify(accounts);
    const script = `try { sessionStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(payload)}); } catch (_e) {}`;
    void view.webContents.executeJavaScript(script, true);
  }

  clearAuthorizedAccounts(origin: string) {
    const view = this.nativeView;
    if (!view) return;
    const script = `
      try {
        sessionStorage.removeItem(${JSON.stringify(`destrall:accounts:${origin}:sui`)});
        sessionStorage.removeItem(${JSON.stringify(`destrall:accounts:${origin}:solana`)});
      } catch (_e) {}
    `;
    void view.webContents.executeJavaScript(script, true);
  }

  refreshWalletInjection() {
    clearSuiClientCache();
    void this.injectWalletStandardScript("network-changed");
  }

  destroy() {
    ipcMain.off(this.walletRequestChannel, this.handleWalletRequest);
    if (!this.nativeView) return;
    if (this.nativeView.kind === "browserView") {
      this.window.setBrowserView(null);
      this.nativeView.view.webContents.close({ waitForBeforeUnload: false });
    } else {
      this.window.contentView.removeChildView(this.nativeView.view);
      this.nativeView.view.webContents.close({ waitForBeforeUnload: false });
    }
    this.nativeView = null;
  }

  private applyBounds() {
    const view = this.nativeView;
    if (!view || !this.visible) return;
    const { x, y, width, height } = this.latestBounds;
    if (width <= 0 || height <= 0) return;
    this.raiseToFront();
    view.view.setBounds({ x, y, width, height });
  }

  /** Keep the guest surface above the shell renderer so dapp content is visible. */
  private raiseToFront() {
    const view = this.nativeView;
    if (!view || view.kind !== "webContentsView") return;
    const parent = this.window.contentView;
    parent.removeChildView(view.view);
    parent.addChildView(view.view);
  }

  private resolveGuestPreloadPath(): string {
    if (this.guestPreloadPath) return this.guestPreloadPath;
    const arg = process.argv.find((value) => value.startsWith("--destrall-guest-preload="));
    return arg ? arg.slice("--destrall-guest-preload=".length) : "";
  }

  private async injectWalletStandardScript(reason: string) {
    const view = this.nativeView;
    if (!view) return;
    try {
      const env = networkSettingsService.getSuiEnvironment();
      const script = buildWalletStandardInjectionForNetwork(env);
      await view.webContents.executeJavaScript(script, true);
      console.debug(
        NativeBrowserViewManager.LOG_PREFIX,
        "injection ok",
        reason,
        view.webContents.getURL(),
      );
    } catch (error) {
      console.warn(
        NativeBrowserViewManager.LOG_PREFIX,
        "injection failed",
        reason,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

let nativeBrowserManager: NativeBrowserViewManager | null = null;

export function getNativeBrowserManager(): NativeBrowserViewManager | null {
  return nativeBrowserManager;
}

function requestRendererBoundsSync(mainWindow: BrowserWindow) {
  if (mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(IPCChannels.nativeBrowserRequestBoundsSync);
}

export function attachNativeBrowserToWindow(mainWindow: BrowserWindow, guestPreloadPath: string) {
  nativeBrowserManager = new NativeBrowserViewManager(mainWindow, guestPreloadPath);

  const onLayoutChange = () => {
    requestRendererBoundsSync(mainWindow);
  };

  mainWindow.on("resize", onLayoutChange);
  mainWindow.on("move", onLayoutChange);
  mainWindow.on("maximize", onLayoutChange);
  mainWindow.on("unmaximize", onLayoutChange);
  mainWindow.on("enter-full-screen", onLayoutChange);
  mainWindow.on("leave-full-screen", onLayoutChange);
  mainWindow.on("closed", () => {
    nativeBrowserManager = null;
  });
  return nativeBrowserManager;
}
