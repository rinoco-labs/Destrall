import { ipcMain, shell } from "electron";
import { IPCChannels } from "../../shared/ipc";
import { TERMS_AND_CONDITIONS_URL } from "../../shared/wallet/terms";
import { openExternalUrlSchema } from "./schemas";

function ok<T>(data: T) {
  return { ok: true as const, data };
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return { ok: false as const, error: message };
}

function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname !== "destrall.com") return false;
    return parsed.href === TERMS_AND_CONDITIONS_URL;
  } catch {
    return false;
  }
}

export function registerAppIpcHandlers() {
  ipcMain.handle(IPCChannels.appOpenExternalUrl, async (_event, payload: unknown) => {
    const parsed = openExternalUrlSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid URL"));
    }
    if (!isAllowedExternalUrl(parsed.data.url)) {
      return fail(new Error("URL is not allowed"));
    }
    try {
      await shell.openExternal(parsed.data.url);
      return ok({ ok: true as const });
    } catch (error) {
      return fail(error);
    }
  });
}
