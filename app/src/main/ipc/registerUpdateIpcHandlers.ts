import { ipcMain } from "electron";
import { z } from "zod";
import { CRITICAL_FLOW_TYPES } from "../../shared/criticalFlows";
import type { RpcResult } from "../../shared/ipc";
import { IPCChannels } from "../../shared/ipc";
import { criticalFlowService } from "../services/security/criticalFlowService";
import { updateService } from "../update/updateService";

function ok<T>(data: T): RpcResult<T> {
  return { ok: true, data };
}

function fail(error: unknown): RpcResult<never> {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return { ok: false, error: message };
}

const criticalFlowSchema = z.object({
  flow: z.enum(CRITICAL_FLOW_TYPES),
});

export function registerUpdateIpcHandlers() {
  ipcMain.handle(IPCChannels.updateCheck, async () => {
    try {
      return ok(await updateService.checkForUpdates());
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.updateDownload, async () => {
    try {
      return ok(await updateService.downloadUpdate());
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.updateOpenDownloaded, async () => {
    try {
      return ok(await updateService.openDownloadedUpdate());
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.updateRevealDownloaded, async () => {
    try {
      return ok(await updateService.revealDownloadedUpdate());
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.updateOpenReleasePage, async () => {
    try {
      return ok(await updateService.openReleasePage());
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.updateGetStatus, async () => {
    try {
      return ok(updateService.getUpdateStatus());
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.updateCancelDownload, async () => {
    try {
      return ok(updateService.cancelDownload());
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.criticalFlowRegister, async (_event, payload: unknown) => {
    const parsed = criticalFlowSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid critical flow"));
    }
    criticalFlowService.register(parsed.data.flow);
    return ok({ ok: true as const });
  });

  ipcMain.handle(IPCChannels.criticalFlowUnregister, async (_event, payload: unknown) => {
    const parsed = criticalFlowSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid critical flow"));
    }
    criticalFlowService.unregister(parsed.data.flow);
    return ok({ ok: true as const });
  });
}
