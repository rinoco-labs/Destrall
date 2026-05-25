import type { ContactEntity } from "../../main/persistence/repositories/contactRepository";
import { walletService } from "../../main/wallet/walletService";

/** Normalize legacy / mixed-case chain values from SQLite. */
export function isSuiChainContact(chain: string): boolean {
  return chain.trim().toLowerCase() === "sui";
}

/**
 * Contacts visible for send resolution and assistant context.
 * Matches the Contacts screen: any Sui contact in this wallet (global or tied to any account).
 */
export function isContactVisibleInWallet(c: ContactEntity, walletAccountIds: Set<string>): boolean {
  if (!isSuiChainContact(c.chain)) return false;
  if (c.accountId == null) return true;
  return walletAccountIds.has(c.accountId);
}

export function walletAccountIdSet(): Set<string> {
  return new Set(walletService.getStatus().accounts.map((a) => a.id));
}
