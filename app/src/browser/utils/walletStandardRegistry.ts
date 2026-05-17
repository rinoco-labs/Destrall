import { getWallets } from "@wallet-standard/app";
import type { Wallet } from "@wallet-standard/core";

/**
 * Wallet-standard registry helper for the Destrall renderer (testing / diagnostics).
 * Dapp discovery happens inside the WebView via injected `register-wallet` events.
 */
export function getRegisteredWallets(): readonly Wallet[] {
  return getWallets().get();
}

export function onWalletRegistryChange(listener: () => void): () => void {
  return getWallets().on("register", listener);
}
