import { useCallback, useEffect, useRef, useState } from "react";
import { useDappConnectionStore, type PendingDappRequest } from "../stores/dappConnectionStore";
import {
  desktopBrowserAuthorizeDapp,
  desktopBrowserWalletConnect,
  desktopBrowserWalletDisconnect,
  desktopBrowserWalletSignAndExecute,
  desktopBrowserWalletSignPersonalMessage,
  desktopBrowserWalletSignTransaction,
  desktopNativeBrowserClearAuthorizedAccounts,
  desktopNativeBrowserPersistAuthorizedAccounts,
  desktopNativeBrowserResolveWalletRequest,
  desktopNativeBrowserSetVisible,
  subscribeNativeBrowserWalletRequest,
} from "../../renderer/lib/desktopBrowser";
import { useWalletStore } from "../../renderer/stores/walletStore";
import { useNetworkStore } from "../../renderer/stores/networkStore";

const ALLOWED_METHODS = new Set([
  "connect",
  "disconnect",
  "sui:signPersonalMessage",
  "sui:signTransaction",
  "sui:signAndExecuteTransaction",
]);

const CONNECT_PERMISSIONS = [
  "viewAccount",
  "signMessage",
  "signTransaction",
  "executeTransaction",
] as const;

function isValidOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function useBrowserWalletBridge() {
  const pending = useDappConnectionStore((s) => s.pending);
  const setPending = useDappConnectionStore((s) => s.setPending);
  const activeAccountId = useWalletStore((s) => s.activeAccountId);
  const accounts = useWalletStore((s) => s.accounts);
  const isUnlocked = useWalletStore((s) => s.isUnlocked);
  const network = useNetworkStore((s) => s.network);
  const [busy, setBusy] = useState(false);
  const silentConnectInflightRef = useRef<
    Map<string, Promise<Awaited<ReturnType<typeof desktopBrowserWalletConnect>>>>
  >(new Map());

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? accounts[0];

  const resolveSupersededConnect = useCallback(async (requestId: string, message: string) => {
    await desktopNativeBrowserResolveWalletRequest({ id: requestId, error: message });
  }, []);

  const resolveSupersededPending = useCallback(
    async (requestId: string, message = "Superseded by a newer wallet request") => {
      await desktopNativeBrowserResolveWalletRequest({ id: requestId, error: message });
    },
    [],
  );

  const replacePending = useCallback(
    async (request: PendingDappRequest, supersedeMessage?: string) => {
      const existing = useDappConnectionStore.getState().pending;
      if (existing && existing.id !== request.id) {
        await resolveSupersededPending(existing.id, supersedeMessage);
      }
      setPending(request);
    },
    [resolveSupersededPending, setPending],
  );

  const rejectPending = useCallback(
    async (message = "User rejected the request") => {
      if (!pending) return;
      await desktopNativeBrowserResolveWalletRequest({
        id: pending.id,
        error: message,
      });
      setPending(null);
    },
    [pending, setPending],
  );

  const handleWalletRequest = useCallback(
    async (request: PendingDappRequest) => {
      if (!ALLOWED_METHODS.has(request.method)) {
        await desktopNativeBrowserResolveWalletRequest({
          id: request.id,
          error: "Unsupported wallet method",
        });
        return;
      }

      if (!isValidOrigin(request.origin)) {
        await desktopNativeBrowserResolveWalletRequest({
          id: request.id,
          error: "Invalid origin",
        });
        return;
      }

      if (!isUnlocked) {
        await desktopNativeBrowserResolveWalletRequest({
          id: request.id,
          error: "Wallet is locked",
        });
        return;
      }

      if (!activeAccount?.id || activeAccount.chain !== "sui") {
        await desktopNativeBrowserResolveWalletRequest({
          id: request.id,
          error: "No active Sui account",
        });
        return;
      }

      const payload = request.payload as { chain?: string; silent?: boolean } | undefined;
      const chain = payload?.chain ?? "sui";
      if (chain !== "sui") {
        await desktopNativeBrowserResolveWalletRequest({
          id: request.id,
          error: "Only Sui is supported",
        });
        return;
      }

      if (request.method === "connect") {
        const originKey = request.origin;
        let shared = silentConnectInflightRef.current.get(originKey);
        if (!shared) {
          shared = desktopBrowserWalletConnect({
            accountId: activeAccount.id,
            origin: request.origin,
            chain: "sui",
            silent: true,
          }).finally(() => {
            silentConnectInflightRef.current.delete(originKey);
          });
          silentConnectInflightRef.current.set(originKey, shared);
        }

        try {
          const result = await shared;
          const hasAccounts = Array.isArray(result.accounts) && result.accounts.length > 0;

          if (payload?.silent || hasAccounts) {
            await desktopNativeBrowserResolveWalletRequest({ id: request.id, result });
            if (hasAccounts) {
              await desktopNativeBrowserPersistAuthorizedAccounts({
                origin: request.origin,
                chain: "sui",
                accounts: result.accounts,
              }).catch(() => undefined);
            }
            return;
          }
        } catch (error) {
          if (payload?.silent) {
            await desktopNativeBrowserResolveWalletRequest({
              id: request.id,
              error: error instanceof Error ? error.message : "Connect failed",
            });
            return;
          }
        }

        const existing = useDappConnectionStore.getState().pending;
        if (existing && existing.method !== "connect") {
          await resolveSupersededConnect(
            request.id,
            "A wallet request is already waiting for approval",
          );
          return;
        }
        if (existing?.method === "connect" && existing.origin === request.origin) {
          await resolveSupersededConnect(
            request.id,
            "A connection request for this site is already waiting for approval",
          );
          return;
        }
        if (existing?.method === "connect") {
          await resolveSupersededPending(existing.id, "Superseded by a newer connection request");
        }

        void desktopNativeBrowserSetVisible(false).catch(() => undefined);
        await replacePending(request);
        return;
      }

      if (request.method === "disconnect") {
        try {
          await desktopBrowserWalletDisconnect({
            accountId: activeAccount.id,
            origin: request.origin,
            chain: "sui",
          });
          await desktopNativeBrowserClearAuthorizedAccounts(request.origin);
          await desktopNativeBrowserResolveWalletRequest({
            id: request.id,
            result: { ok: true },
          });
        } catch (error) {
          await desktopNativeBrowserResolveWalletRequest({
            id: request.id,
            error: error instanceof Error ? error.message : "Disconnect failed",
          });
        }
        return;
      }

      await replacePending(request);
    },
    [activeAccount, isUnlocked, replacePending, resolveSupersededConnect, resolveSupersededPending],
  );

  useEffect(() => {
    try {
      return subscribeNativeBrowserWalletRequest((request) => {
        void handleWalletRequest({ ...request, receivedAt: Date.now() });
      });
    } catch (error) {
      console.error("[browser] wallet bridge unavailable", error);
      return undefined;
    }
  }, [handleWalletRequest]);

  // Native WebContentsView renders above the React shell; hide it while approval UI is open.
  useEffect(() => {
    if (!pending) return;
    void desktopNativeBrowserSetVisible(false).catch(() => undefined);
    return () => {
      void desktopNativeBrowserSetVisible(true).catch(() => undefined);
    };
  }, [pending]);

  const approvePending = useCallback(async () => {
    if (!pending || !activeAccount?.id) return;
    setBusy(true);
    try {
      const networkLabel = network?.chainIdLabel ?? "sui:mainnet";

      if (pending.method === "connect") {
        const requestId = pending.id;
        const origin = pending.origin;
        const result = await desktopBrowserWalletConnect({
          accountId: activeAccount.id,
          origin,
          chain: "sui",
          silent: false,
        });
        // Resolve the dapp first (app-copy pattern) so connect completes even if persistence fails.
        await desktopNativeBrowserResolveWalletRequest({ id: requestId, result });
        await desktopNativeBrowserPersistAuthorizedAccounts({
          origin,
          chain: "sui",
          accounts: result.accounts,
        });
        try {
          await desktopBrowserAuthorizeDapp({
            accountId: activeAccount.id,
            origin,
            displayName: origin,
            accountAddress: activeAccount.address,
            network: networkLabel,
            permissions: [...CONNECT_PERMISSIONS],
          });
        } catch (persistError) {
          console.warn(
            "[browser] dapp authorize persistence failed (wallet is connected)",
            persistError instanceof Error ? persistError.message : persistError,
          );
        }
        setPending(null);
        return;
      }

      if (pending.method === "disconnect") {
        await desktopBrowserWalletDisconnect({
          accountId: activeAccount.id,
          origin: pending.origin,
          chain: "sui",
        });
        await desktopNativeBrowserClearAuthorizedAccounts(pending.origin);
        await desktopNativeBrowserResolveWalletRequest({
          id: pending.id,
          result: { ok: true },
        });
        setPending(null);
        return;
      }

      const payload = pending.payload as Record<string, unknown>;

      const authorizeForSigning = async () => {
        await desktopBrowserAuthorizeDapp({
          accountId: activeAccount.id,
          origin: pending.origin,
          displayName: pending.origin,
          accountAddress: activeAccount.address,
          network: networkLabel,
          permissions: [...CONNECT_PERMISSIONS],
        });
        const connectResult = await desktopBrowserWalletConnect({
          accountId: activeAccount.id,
          origin: pending.origin,
          chain: "sui",
          silent: false,
        });
        if (connectResult.accounts.length > 0) {
          await desktopNativeBrowserPersistAuthorizedAccounts({
            origin: pending.origin,
            chain: "sui",
            accounts: connectResult.accounts,
          }).catch(() => undefined);
        }
      };

      if (pending.method === "sui:signPersonalMessage") {
        await authorizeForSigning();
        const messageBase64 = String(payload.message ?? "");
        const result = await desktopBrowserWalletSignPersonalMessage({
          accountId: activeAccount.id,
          origin: pending.origin,
          messageBase64,
        });
        await desktopNativeBrowserResolveWalletRequest({ id: pending.id, result });
        setPending(null);
        return;
      }

      if (pending.method === "sui:signTransaction") {
        await authorizeForSigning();
        const txDataJson = String(payload.txData ?? "");
        const result = await desktopBrowserWalletSignTransaction({
          accountId: activeAccount.id,
          origin: pending.origin,
          txDataJson,
        });
        await desktopNativeBrowserResolveWalletRequest({ id: pending.id, result });
        setPending(null);
        return;
      }

      if (pending.method === "sui:signAndExecuteTransaction") {
        await authorizeForSigning();
        const txDataJson = String(payload.txData ?? "");
        const result = await desktopBrowserWalletSignAndExecute({
          accountId: activeAccount.id,
          origin: pending.origin,
          txDataJson,
        });
        await desktopNativeBrowserResolveWalletRequest({ id: pending.id, result });
        setPending(null);
      }
    } catch (error) {
      await desktopNativeBrowserResolveWalletRequest({
        id: pending.id,
        error: error instanceof Error ? error.message : "Request failed",
      });
      setPending(null);
    } finally {
      setBusy(false);
    }
  }, [activeAccount, network, pending, setPending]);

  return {
    pending,
    busy,
    activeAccount,
    networkLabel: network?.chainIdLabel ?? "sui:mainnet",
    approvePending,
    rejectPending: (): void => {
      void rejectPending();
    },
  };
}
