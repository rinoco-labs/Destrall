import { app, BrowserWindow, nativeImage, type NativeImage } from "electron";
import fs from "node:fs";
import path from "node:path";
import started from "electron-squirrel-startup";
import { getBrandingDir, getBrandingRuntimeIconPath } from "./main/lib/brandingPaths";
import { getDatabase } from "./main/persistence/database";
import { registerChainIpcHandlers } from "./main/ipc/registerChainIpcHandlers";
import { registerAppIpcHandlers } from "./main/ipc/registerAppIpcHandlers";
import { registerWalletIpcHandlers } from "./main/ipc/registerWalletIpcHandlers";
import { registerAiModelIpcHandlers } from "./main/ipc/registerAiModelIpcHandlers";
import { registerAssistantChatIpcHandlers } from "./main/ipc/registerAssistantChatIpcHandlers";
import { registerTriggersIpcHandlers } from "./main/ipc/registerTriggersIpcHandlers";
import { registerBrowserIpcHandlers } from "./main/ipc/registerBrowserIpcHandlers";
import { registerUpdateIpcHandlers } from "./main/ipc/registerUpdateIpcHandlers";
import { attachNativeBrowserToWindow } from "./main/browser/nativeBrowserViewManager";
import { startTriggerScheduler } from "./packages/core/triggers/triggerScheduler";
import { timezoneSettingsService } from "./services/time/timezone.service";
import { aiModelMainService } from "./main/ai/aiModelMainService";
import { probeLlmEngine } from "./main/ai/llmEngineProbe";
import { registerCorePackages } from "./packages/runtime/registerCorePackages";

if (started) {
  app.quit();
}

function loadPlatformIcon(): NativeImage | undefined {
  const dir = getBrandingDir();
  const candidates: string[] = [path.resolve(getBrandingRuntimeIconPath())];

  if (process.platform === "darwin") {
    candidates.push(path.join(dir, "desktop-icon.png"));
  }

  for (const iconPath of candidates) {
    if (!fs.existsSync(iconPath)) {
      continue;
    }
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      return icon;
    }
  }

  console.warn(`[branding] App icon could not be loaded from ${candidates.join(", ")}`);
  return undefined;
}

/** Dock (macOS) + taskbar (Windows/Linux). */
function applyAppIcon(): void {
  const icon = loadPlatformIcon();
  if (!icon) {
    return;
  }
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(icon);
  }
  app.setAppUserModelId?.("com.destrall.app");
}

const createWindow = () => {
  const guestPreload = path.join(__dirname, "preload-browser-guest.js");
  const icon = loadPlatformIcon();
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    ...(icon ? { icon } : {}),
    title: "Destrall",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [`--destrall-guest-preload=${guestPreload}`],
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  attachNativeBrowserToWindow(mainWindow, guestPreload);
};

app.whenReady().then(() => {
  applyAppIcon();
  getDatabase();
  timezoneSettingsService.initialize();
  registerCorePackages();
  registerChainIpcHandlers();
  registerAppIpcHandlers();
  registerWalletIpcHandlers();
  registerAiModelIpcHandlers();
  registerAssistantChatIpcHandlers();
  registerTriggersIpcHandlers();
  registerBrowserIpcHandlers();
  registerUpdateIpcHandlers();
  startTriggerScheduler();
  void probeLlmEngine()
    .then(() => aiModelMainService.restoreFromPersistence())
    .catch((err) => {
      console.error("[llm] Startup LLM init failed", err);
    });
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  applyAppIcon();
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
