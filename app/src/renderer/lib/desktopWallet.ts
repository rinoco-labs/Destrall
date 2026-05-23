import type { RpcResult } from "../../shared/ipc";
import type { WalletAccount, WalletProfile, WalletStatusSnapshot } from "../../shared/wallet/types";

function api() {
  if (typeof window === "undefined" || !window.destrallApi) {
    throw new Error("Destrall API is not available in this context.");
  }
  return window.destrallApi;
}

export function isDestrallDesktop(): boolean {
  return typeof window !== "undefined" && !!window.destrallApi;
}

async function unwrap<T>(result: Promise<RpcResult<T>>): Promise<T> {
  const response = await result;
  if (response.ok === false) {
    throw new Error(response.error);
  }
  return response.data;
}

export async function desktopGetWalletStatus(): Promise<WalletStatusSnapshot> {
  return unwrap(api().wallet.getStatus());
}

export async function desktopPreviewMnemonic(): Promise<string> {
  return unwrap(api().wallet.previewMnemonic());
}

export async function desktopCreateWallet(params: {
  mnemonic: string;
  password: string;
  profileName?: string;
  accountName?: string;
  termsAccepted: true;
}): Promise<WalletAccount> {
  return unwrap(api().wallet.createWallet(params));
}

export async function desktopImportWallet(params: {
  mnemonic: string;
  password: string;
  profileName?: string;
  accountName?: string;
  termsAccepted: true;
}): Promise<WalletAccount> {
  return unwrap(api().wallet.importWallet(params));
}

export async function desktopOpenExternalUrl(url: string): Promise<void> {
  await unwrap(api().app.openExternalUrl({ url }));
}

export async function desktopCreateAccount(params: { name: string }): Promise<WalletAccount> {
  return unwrap(api().wallet.createAccount(params));
}

export async function desktopSwitchAccount(accountId: string): Promise<string> {
  const result = await unwrap(api().wallet.switchAccount(accountId));
  return result.activeAccountId;
}

export async function desktopRenameAccount(accountId: string, name: string): Promise<WalletAccount> {
  return unwrap(api().wallet.renameAccount({ accountId, name }));
}

export async function desktopUpdateAccountIcon(
  accountId: string,
  icon?: string | null,
  color?: string | null,
): Promise<WalletAccount> {
  return unwrap(api().wallet.updateAccountIcon({ accountId, icon, color }));
}

export async function desktopUnlockWallet(password: string): Promise<void> {
  await unwrap(api().wallet.unlockSession(password));
}

export async function desktopLockWallet(): Promise<void> {
  await unwrap(api().wallet.lockSession());
}

export async function desktopViewSeedPhrase(password: string): Promise<string> {
  return unwrap(api().wallet.viewSeedPhrase(password));
}

export async function desktopDisconnectWallet(): Promise<void> {
  await unwrap(api().wallet.disconnect());
}

export async function desktopRefreshWallet(): Promise<WalletStatusSnapshot> {
  return unwrap(api().wallet.refresh());
}

export type { WalletAccount, WalletProfile, WalletStatusSnapshot };
