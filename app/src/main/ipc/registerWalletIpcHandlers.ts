import { ipcMain } from "electron";
import { IPCChannels } from "../../shared/ipc";
import {
  walletAccountIdSchema,
  walletCreateAccountSchema,
  walletCreateSchema,
  walletRenameAccountSchema,
  walletUnlockSessionSchema,
  walletUpdateAccountIconSchema,
  walletViewSeedSchema,
} from "./schemas";
import { walletService } from "../wallet/walletService";

function ok<T>(data: T) {
  return { ok: true as const, data };
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return { ok: false as const, error: message };
}

export function registerWalletIpcHandlers() {
  ipcMain.handle(IPCChannels.walletGetStatus, async () => {
    try {
      return ok(walletService.getStatus());
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.walletPreviewMnemonic, async () => {
    try {
      return ok(walletService.previewMnemonic());
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.walletCreate, async (_event, payload: unknown) => {
    const parsed = walletCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid wallet create request"));
    }
    try {
      return ok(
        walletService.createOrImportWallet({
          mnemonic: parsed.data.mnemonic,
          password: parsed.data.password,
          profileName: parsed.data.profileName,
          accountName: parsed.data.accountName,
          imported: false,
        }),
      );
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.walletImport, async (_event, payload: unknown) => {
    const parsed = walletCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid wallet import request"));
    }
    try {
      return ok(
        walletService.createOrImportWallet({
          mnemonic: parsed.data.mnemonic,
          password: parsed.data.password,
          profileName: parsed.data.profileName,
          accountName: parsed.data.accountName,
          imported: true,
        }),
      );
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.walletCreateAccount, async (_event, payload: unknown) => {
    const parsed = walletCreateAccountSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid request"));
    }
    try {
      return ok(walletService.createAdditionalAccount({ name: parsed.data.name }));
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.walletSwitchAccount, async (_event, payload: unknown) => {
    const parsed = walletAccountIdSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid account id"));
    }
    try {
      return ok(walletService.switchAccount(parsed.data.accountId));
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.walletRenameAccount, async (_event, payload: unknown) => {
    const parsed = walletRenameAccountSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid request"));
    }
    try {
      return ok(walletService.renameAccount(parsed.data.accountId, parsed.data.name));
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.walletUpdateAccountIcon, async (_event, payload: unknown) => {
    const parsed = walletUpdateAccountIconSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid request"));
    }
    try {
      return ok(
        walletService.updateAccountIcon(
          parsed.data.accountId,
          parsed.data.icon,
          parsed.data.color,
        ),
      );
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.walletUnlockSession, async (_event, payload: unknown) => {
    const parsed = walletUnlockSessionSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid unlock request"));
    }
    try {
      walletService.unlockSessionWithPassword(parsed.data.password);
      return ok({ ok: true as const });
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.walletLockSession, async () => {
    try {
      walletService.lockSession();
      return ok({ ok: true as const });
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.walletViewSeedPhrase, async (_event, payload: unknown) => {
    const parsed = walletViewSeedSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid request"));
    }
    try {
      return ok(walletService.viewSeedPhrase(parsed.data.password));
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.walletDisconnect, async () => {
    try {
      walletService.disconnect();
      return ok({ ok: true as const });
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.walletRefresh, async () => {
    try {
      return ok(walletService.getStatus());
    } catch (error) {
      return fail(error);
    }
  });
}
