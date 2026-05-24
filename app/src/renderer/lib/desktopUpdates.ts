import type { RpcResult, UpdateInfo } from "../../shared/ipc";
import type { CriticalFlowType } from "../../shared/criticalFlows";
import { isDestrallDesktop } from "./desktopWallet";

function api() {
  if (!isDestrallDesktop() || !window.destrallApi) {
    throw new Error("Destrall desktop API is not available.");
  }
  return window.destrallApi;
}

function unwrap<T>(result: RpcResult<T>): T {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data;
}

export async function desktopUpdateCheck(): Promise<UpdateInfo> {
  return unwrap(await api().updates.check());
}

export async function desktopUpdateDownload(): Promise<UpdateInfo> {
  return unwrap(await api().updates.download());
}

export async function desktopUpdateOpenDownloaded(): Promise<UpdateInfo> {
  return unwrap(await api().updates.openDownloaded());
}

export async function desktopUpdateRevealDownloaded(): Promise<UpdateInfo> {
  return unwrap(await api().updates.revealDownloaded());
}

export async function desktopUpdateOpenReleasePage(): Promise<UpdateInfo> {
  return unwrap(await api().updates.openReleasePage());
}

export async function desktopUpdateGetStatus(): Promise<UpdateInfo> {
  return unwrap(await api().updates.getStatus());
}

export async function desktopUpdateCancelDownload(): Promise<UpdateInfo> {
  return unwrap(await api().updates.cancelDownload());
}

export function subscribeUpdateStatus(listener: (status: UpdateInfo) => void): () => void {
  return api().updates.onStatusChanged(listener);
}

export async function desktopCriticalFlowRegister(flow: CriticalFlowType): Promise<void> {
  unwrap(await api().criticalFlow.register(flow));
}

export async function desktopCriticalFlowUnregister(flow: CriticalFlowType): Promise<void> {
  unwrap(await api().criticalFlow.unregister(flow));
}
