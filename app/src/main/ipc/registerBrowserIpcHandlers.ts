import { ipcMain } from "electron";
import { IPCChannels } from "../../shared/ipc";
import { getNativeBrowserManager } from "../browser/nativeBrowserViewManager";
import { browserStateRepository } from "../browser/browserState.repository";
import { originPermissionsService } from "../browser/originPermissions.service";
import { suiDappSigningService } from "../browser/suiDappSigning.service";
import { suiTransactionPreviewService } from "../browser/suiTransactionPreview.service";
import { walletService } from "../wallet/walletService";
import { walletSession } from "../wallet/walletSession";
import { deriveSuiAccountFromMnemonic } from "../services/chains/sui/sui-wallet.service";
import {
  suiChainLabelForEnvironment,
  suiWalletStandardAccountRow,
} from "../../browser/chains/sui/suiWalletProvider";
import { networkSettingsService } from "../services/network/networkSettingsService";
import {
  browserAccountIdSchema,
  browserAuthorizeDappSchema,
  browserReplaceStateSchema,
  browserWalletConnectSchema,
  browserWalletDisconnectSchema,
  browserWalletSignPersonalMessageSchema,
  browserWalletSignTransactionSchema,
  browserPreviewTransactionSchema,
  nativeBrowserClearAuthorizedAccountsSchema,
  nativeBrowserNavigateSchema,
  nativeBrowserPersistAuthorizedAccountsSchema,
  nativeBrowserResolveWalletRequestSchema,
  nativeBrowserViewportBoundsSchema,
} from "./browserSchemas";

function ok<T>(data: T) {
  return { ok: true as const, data };
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return { ok: false as const, error: message };
}

function requireNativeBrowser() {
  const nativeBrowser = getNativeBrowserManager();
  if (!nativeBrowser) throw new Error("Native browser is not available");
  return nativeBrowser;
}

function buildSuiConnectAccounts(accountId: string) {
  const account = walletService.getWalletAccount(accountId);
  if (!account || account.chain !== "sui") {
    throw new Error("Active Sui account not found.");
  }
  const mnemonic = walletSession.getMnemonic();
  if (!mnemonic) throw new Error("Wallet is locked. Unlock Destrall to connect.");
  const keyMaterial = deriveSuiAccountFromMnemonic(mnemonic, account.accountIndex);
  if (keyMaterial.address !== account.address) {
    throw new Error("Active account does not match derived key material.");
  }
  const env = networkSettingsService.getSuiEnvironment();
  const chainLabel = suiChainLabelForEnvironment(env);
  const publicKeyBytes = Buffer.from(account.publicKey, "base64");
  if (publicKeyBytes.length !== 32) {
    throw new Error("Stored account public key is invalid.");
  }
  return {
    accounts: [
      suiWalletStandardAccountRow({
        address: account.address,
        publicKeyBytes,
        chainLabel,
      }),
    ],
  };
}

export function registerBrowserIpcHandlers() {
  ipcMain.handle(IPCChannels.nativeBrowserSetViewportBounds, async (_event, payload: unknown) => {
    const parsed = nativeBrowserViewportBoundsSchema.safeParse(payload);
    if (!parsed.success) return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid bounds"));
    try {
      const bounds = parsed.data;
      requireNativeBrowser().setViewportBounds(bounds);
      return ok({ ok: true });
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.nativeBrowserSetVisible, async (_event, visible: unknown) => {
    if (typeof visible !== "boolean") return fail(new Error("Invalid visibility"));
    try {
      requireNativeBrowser().setVisible(visible);
      return ok({ ok: true });
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.nativeBrowserNavigate, async (_event, payload: unknown) => {
    const parsed = nativeBrowserNavigateSchema.safeParse(payload);
    if (!parsed.success) return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid URL"));
    try {
      requireNativeBrowser().navigate(parsed.data);
      return ok({ ok: true });
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.nativeBrowserGoBack, async () => {
    try {
      requireNativeBrowser().goBack();
      return ok({ ok: true });
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.nativeBrowserGoForward, async () => {
    try {
      requireNativeBrowser().goForward();
      return ok({ ok: true });
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.nativeBrowserReload, async () => {
    try {
      requireNativeBrowser().reload();
      return ok({ ok: true });
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.nativeBrowserResolveWalletRequest, async (_event, payload: unknown) => {
    const parsed = nativeBrowserResolveWalletRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid wallet resolution"));
    }
    try {
      await requireNativeBrowser().resolveWalletRequest(
        parsed.data.id,
        parsed.data.result,
        parsed.data.error,
      );
      return ok({ ok: true });
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(
    IPCChannels.nativeBrowserPersistAuthorizedAccounts,
    async (_event, payload: unknown) => {
      const parsed = nativeBrowserPersistAuthorizedAccountsSchema.safeParse(payload);
      if (!parsed.success) {
        return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid account cache"));
      }
      try {
        const { origin, chain, accounts } = parsed.data;
        requireNativeBrowser().persistAuthorizedAccounts(origin, chain, accounts);
        return ok({ ok: true });
      } catch (error) {
        return fail(error);
      }
    },
  );

  ipcMain.handle(
    IPCChannels.nativeBrowserClearAuthorizedAccounts,
    async (_event, payload: unknown) => {
      const parsed = nativeBrowserClearAuthorizedAccountsSchema.safeParse(payload);
      if (!parsed.success) {
        return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid cache clear"));
      }
      try {
        requireNativeBrowser().clearAuthorizedAccounts(parsed.data.origin);
        return ok({ ok: true });
      } catch (error) {
        return fail(error);
      }
    },
  );

  ipcMain.handle(IPCChannels.browserGetState, async (_event, payload: unknown) => {
    const parsed = browserAccountIdSchema.safeParse(payload);
    if (!parsed.success) return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid account"));
    try {
      return ok(browserStateRepository.getByAccount(parsed.data.accountId));
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.browserReplaceState, async (_event, payload: unknown) => {
    const parsed = browserReplaceStateSchema.safeParse(payload);
    if (!parsed.success) return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid state"));
    try {
      return ok(
        browserStateRepository.replaceForAccount(parsed.data.accountId, parsed.data.state),
      );
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.browserAuthorizeDapp, async (_event, payload: unknown) => {
    const parsed = browserAuthorizeDappSchema.safeParse(payload);
    if (!parsed.success) return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid dapp"));
    try {
      const account = walletService.getWalletAccount(parsed.data.accountId);
      if (!account) {
        return fail(new Error("Active wallet account not found."));
      }
      originPermissionsService.authorize({
        accountId: parsed.data.accountId,
        origin: parsed.data.origin,
        chain: "sui",
        permissions: parsed.data.permissions,
      });
      return ok(
        browserStateRepository.authorizeDapp({
          accountId: parsed.data.accountId,
          origin: parsed.data.origin,
          displayName: parsed.data.displayName,
          accountAddress: parsed.data.accountAddress,
          network: parsed.data.network,
          permissions: parsed.data.permissions,
        }),
      );
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.browserWalletConnect, async (_event, payload: unknown) => {
    const parsed = browserWalletConnectSchema.safeParse(payload);
    if (!parsed.success) return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid connect"));
    if (parsed.data.chain !== "sui") {
      return fail(new Error("Only Sui is supported in the browser wallet."));
    }
    try {
      if (parsed.data.silent) {
        const authorized = originPermissionsService.isAuthorized({
          accountId: parsed.data.accountId,
          origin: parsed.data.origin,
          chain: "sui",
          permission: "viewAccount",
        });
        if (!authorized) return ok({ accounts: [] });
      }
      return ok(buildSuiConnectAccounts(parsed.data.accountId));
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.browserWalletDisconnect, async (_event, payload: unknown) => {
    const parsed = browserWalletDisconnectSchema.safeParse(payload);
    if (!parsed.success) return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid disconnect"));
    try {
      originPermissionsService.revoke({
        accountId: parsed.data.accountId,
        origin: parsed.data.origin,
        chain: parsed.data.chain,
      });
      requireNativeBrowser().clearAuthorizedAccounts(parsed.data.origin);
      return ok({ ok: true });
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.browserWalletSignPersonalMessage, async (_event, payload: unknown) => {
    const parsed = browserWalletSignPersonalMessageSchema.safeParse(payload);
    if (!parsed.success) return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid request"));
    try {
      const data = parsed.data;
      return ok(suiDappSigningService.signPersonalMessage(data));
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.browserWalletSignTransaction, async (_event, payload: unknown) => {
    const parsed = browserWalletSignTransactionSchema.safeParse(payload);
    if (!parsed.success) return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid request"));
    try {
      const data = parsed.data;
      return ok(await suiDappSigningService.signTransaction(data));
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.browserWalletSignAndExecute, async (_event, payload: unknown) => {
    const parsed = browserWalletSignTransactionSchema.safeParse(payload);
    if (!parsed.success) return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid request"));
    try {
      const data = parsed.data;
      return ok(await suiDappSigningService.signAndExecuteTransaction(data));
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.browserPreviewTransaction, async (_event, payload: unknown) => {
    const parsed = browserPreviewTransactionSchema.safeParse(payload);
    if (!parsed.success) return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid preview"));
    try {
      return ok(await suiTransactionPreviewService.preview(parsed.data));
    } catch (error) {
      return fail(error);
    }
  });
}
