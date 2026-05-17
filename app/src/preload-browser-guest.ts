import { contextBridge, ipcRenderer } from "electron";
import { IPCChannels } from "./shared/ipc";

const WALLET_RESPONSE_MESSAGE = "destrall-wallet-response";

contextBridge.exposeInMainWorld("__destrallWalletBridge", {
  emit: (packet: unknown) => {
    ipcRenderer.send(IPCChannels.nativeBrowserWalletRequest, packet);
  },
});

ipcRenderer.on(IPCChannels.nativeBrowserWalletResponse, (_event, message: unknown) => {
  window.postMessage({ type: WALLET_RESPONSE_MESSAGE, ...(message as object) }, "*");
});
