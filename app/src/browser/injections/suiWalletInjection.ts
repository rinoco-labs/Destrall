import { SOLANA_BROWSER_ENABLED } from "../chains/solana/placeholder";
import { WALLET_INJECTION_ICON_DATA_URI } from "../../config/walletInjectionIcon";

export type WalletInjectionOptions = {
  suiChainLabel: string;
  walletDisplayName: string;
};

/**
 * Wallet-standard provider injected into the dapp WebView (main frame only).
 * Secrets never cross this boundary — only request/response envelopes via the guest preload bridge.
 */
export function buildSuiWalletStandardInjectionScript(options: WalletInjectionOptions): string {
  const suiChainLabel = JSON.stringify(options.suiChainLabel);
  const walletName = JSON.stringify(options.walletDisplayName);
  const registerSolana = SOLANA_BROWSER_ENABLED ? "true" : "false";

  return `
(() => {
  if (window.__destrallWalletInjected) return;
  window.__destrallWalletInjected = true;
  const pending = new Map();
  const LOG_PREFIX = "[destrall:wallet-inject]";
  const walletIcon = ${JSON.stringify(WALLET_INJECTION_ICON_DATA_URI)};

  function toBase64(value) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value || []);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  async function serializeSignTransactionInput(input) {
    const tx = (input && (input.transaction || input.transactionBlock)) || null;
    let transactionPayload = null;
    if (tx && typeof tx.toJSON === "function") {
      transactionPayload = await tx.toJSON();
    } else if (tx && typeof tx.serialize === "function") {
      transactionPayload = tx.serialize();
    } else if (tx && typeof tx.getData === "function") {
      transactionPayload = JSON.stringify(tx.getData());
    } else if (typeof tx === "string") {
      transactionPayload = tx;
    } else if (tx instanceof Uint8Array) {
      transactionPayload = toBase64(tx);
    }

    const account = input && input.account;
    let accountPayload = null;
    if (account) {
      const pk = account.publicKey;
      accountPayload = {
        address: account.address,
        publicKey: pk instanceof Uint8Array ? Array.from(pk) : pk,
        chains: account.chains,
      };
    }

    return JSON.stringify({
      version: 2,
      transaction: transactionPayload,
      chain: input && input.chain,
      account: accountPayload,
    });
  }

  function hostRequest(method, payload) {
    return new Promise((resolve, reject) => {
      const id = "destrall:" + Math.random().toString(36).slice(2);
      pending.set(id, { resolve, reject });
      const bridge = window.__destrallWalletBridge;
      if (!bridge || typeof bridge.emit !== "function") {
        pending.delete(id);
        console.warn(LOG_PREFIX, "bridge unavailable", method);
        reject(new Error("Destrall wallet bridge is not available in this view."));
        return;
      }
      bridge.emit({
        type: "destrall-wallet-request",
        id,
        method,
        payload,
        origin: window.location.origin,
        timestamp: Date.now(),
      });
    });
  }

  function deliverWalletResponse(message) {
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) {
      console.warn(LOG_PREFIX, "request rejected", message.id, message.error);
      entry.reject(new Error(message.error));
    } else entry.resolve(message.result);
  }

  window.__destrallResolveWalletRequest = deliverWalletResponse;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.type !== "destrall-wallet-response" || !data.id) return;
    deliverWalletResponse(data);
  });

  function normalizeAccountRow(row) {
    const pk = row && row.publicKey;
    const publicKey =
      pk instanceof Uint8Array ? pk : new Uint8Array(Array.isArray(pk) ? pk : []);
    return {
      address: row.address,
      publicKey,
      chains: row.chains,
      features: row.features,
    };
  }

  function normalizeConnectAccounts(result) {
    const list = result && result.accounts;
    if (!Array.isArray(list)) return [];
    return list.map(normalizeAccountRow);
  }

  function readCachedAccounts(chainKey) {
    try {
      const key = "destrall:accounts:" + window.location.origin + ":" + chainKey;
      const raw = sessionStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((row) => ({
        address: row.address,
        publicKey: new Uint8Array(row.publicKey || []),
        chains: row.chains,
        features: row.features,
      }));
    } catch (_e) {
      return [];
    }
  }

  function createSuiWallet() {
    const chainKey = "sui";
    const suiChain = ${suiChainLabel};
    let accounts = readCachedAccounts(chainKey);
    const listeners = new Set();
    let silentConnectInFlight = null;
    let interactiveConnectInFlight = null;

    function emitAccountsChanged() {
      listeners.forEach((listener) => listener({ accounts }));
    }

    const features = {
      "standard:connect": {
        version: "1.0.0",
        connect: async (input) => {
          const silent = Boolean(input && input.silent);
          if (silent) {
            if (silentConnectInFlight) return silentConnectInFlight;
            silentConnectInFlight = (async () => {
              try {
                const response = await hostRequest("connect", { chain: chainKey, silent: true });
                const next = normalizeConnectAccounts(response);
                accounts = next;
                if (!next.length) {
                  try {
                    sessionStorage.removeItem(
                      "destrall:accounts:" + window.location.origin + ":" + chainKey,
                    );
                  } catch (_e) {}
                }
                emitAccountsChanged();
                return { accounts: next };
              } finally {
                silentConnectInFlight = null;
              }
            })();
            return silentConnectInFlight;
          }
          if (interactiveConnectInFlight) return interactiveConnectInFlight;
          interactiveConnectInFlight = (async () => {
            try {
              const response = await hostRequest("connect", { chain: chainKey, silent: false });
              accounts = normalizeConnectAccounts(response);
              emitAccountsChanged();
              return { accounts };
            } finally {
              interactiveConnectInFlight = null;
            }
          })();
          return interactiveConnectInFlight;
        },
      },
      "standard:disconnect": {
        version: "1.0.0",
        disconnect: async () => {
          await hostRequest("disconnect", { chain: chainKey });
          try {
            sessionStorage.removeItem("destrall:accounts:" + window.location.origin + ":" + chainKey);
          } catch (_e) {}
          accounts = [];
          emitAccountsChanged();
        },
      },
      "standard:events": {
        version: "1.0.0",
        on: (_event, listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
      "sui:signPersonalMessage": {
        version: "1.1.0",
        signPersonalMessage: async (input) =>
          hostRequest("sui:signPersonalMessage", {
            message: toBase64(input.message),
          }),
      },
      "sui:signTransaction": {
        version: "2.0.0",
        signTransaction: async (input) =>
          hostRequest("sui:signTransaction", {
            txData: await serializeSignTransactionInput(input),
          }),
      },
      "sui:signAndExecuteTransaction": {
        version: "2.0.0",
        signAndExecuteTransaction: async (input) =>
          hostRequest("sui:signAndExecuteTransaction", {
            txData: await serializeSignTransactionInput(input),
          }),
      },
      "sui:signTransactionBlock": {
        version: "1.0.0",
        signTransactionBlock: async (input) =>
          hostRequest("sui:signTransaction", {
            txData: await serializeSignTransactionInput(input),
          }),
      },
      "sui:signAndExecuteTransactionBlock": {
        version: "1.0.0",
        signAndExecuteTransactionBlock: async (input) =>
          hostRequest("sui:signAndExecuteTransaction", {
            txData: await serializeSignTransactionInput(input),
          }),
      },
    };

    return {
      get version() {
        return "1.0.0";
      },
      get name() {
        return ${walletName};
      },
      get icon() {
        return walletIcon;
      },
      get chains() {
        return [suiChain];
      },
      get accounts() {
        return accounts;
      },
      get features() {
        return features;
      },
    };
  }

  const suiWallet = createSuiWallet();
  let walletRegistered = false;
  const registerOnce = () => {
    if (walletRegistered) return;
    walletRegistered = true;
    window.dispatchEvent(
      new CustomEvent("wallet-standard:register-wallet", {
        detail: (api) => {
          api.register(suiWallet);
        },
      }),
    );
    console.debug(LOG_PREFIX, "register-wallet", window.location.href);
  };

  registerOnce();
  window.addEventListener("wallet-standard:app-ready", registerOnce);
})();
`;
}
