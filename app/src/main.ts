import { app, BrowserWindow } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { getDatabase } from "./main/persistence/database";
import { registerChainIpcHandlers } from "./main/ipc/registerChainIpcHandlers";
import { registerWalletIpcHandlers } from "./main/ipc/registerWalletIpcHandlers";
import { registerAiModelIpcHandlers } from "./main/ipc/registerAiModelIpcHandlers";
import { registerAssistantChatIpcHandlers } from "./main/ipc/registerAssistantChatIpcHandlers";
import { registerTriggersIpcHandlers } from "./main/ipc/registerTriggersIpcHandlers";
import { startTriggerScheduler } from "./packages/core/triggers/triggerScheduler";
import { timezoneSettingsService } from "./services/time/timezone.service";
import { aiModelMainService } from "./main/ai/aiModelMainService";
import { registerCorePackages } from "./packages/runtime/registerCorePackages";

if (started) {
  app.quit();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

app.whenReady().then(() => {
  getDatabase();
  timezoneSettingsService.initialize();
  registerCorePackages();
  registerChainIpcHandlers();
  registerWalletIpcHandlers();
  registerAiModelIpcHandlers();
  registerAssistantChatIpcHandlers();
  registerTriggersIpcHandlers();
  startTriggerScheduler();
  void aiModelMainService.restoreFromPersistence().catch((err) => {
    console.error("[llm] Startup restore failed", err);
  });
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
