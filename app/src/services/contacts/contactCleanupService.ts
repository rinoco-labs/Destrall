import type { DatabaseSync } from "node:sqlite";
import { contactRepository } from "../../main/persistence/repositories/contactRepository";
import { getDatabase } from "../../main/persistence/database";
import { assistantDataCache } from "../../assistant/cache/assistantDataCache";
import { clearSuinsClientCache } from "../suins/suinsResolutionService";
import { clearAllContactsDb, shortAccountId } from "./contactCleanupDb";

export { clearAllContactsDb, clearContactsForAccountDb, shortAccountId } from "./contactCleanupDb";

export async function clearContactsForAccount(accountId: string): Promise<void> {
  const removed = contactRepository.clearForAccount(accountId);
  if (process.env.NODE_ENV !== "production") {
    console.debug("[contacts] cleared contacts for account", shortAccountId(accountId), { removed });
  }
}

export async function clearAllContacts(): Promise<void> {
  const removed = contactRepository.clearAll();
  if (process.env.NODE_ENV !== "production") {
    console.debug("[contacts] cleared all contacts", { removed });
  }
}

/** Drop assistant balance/activity caches and SuiNS client cache for the session. */
export function clearRecipientCachesForAccounts(accountIds: string[]): void {
  for (const id of accountIds) {
    assistantDataCache.invalidateAccount(id);
  }
  clearSuinsClientCache();
}

/**
 * Full wallet logout / vault removal: wipe all local contacts and recipient caches.
 * Call before deleting wallet rows so account ids are still available for logging.
 */
export async function clearContactsOnWalletLogout(params: {
  activeAccountId: string | null;
  accountIds: string[];
}): Promise<void> {
  const db = getDatabase();
  try {
    const removed = clearAllContactsDb(db);
    if (process.env.NODE_ENV !== "production") {
      const hint = params.activeAccountId ? shortAccountId(params.activeAccountId) : "none";
      console.debug("[contacts] cleared all contacts on wallet logout", { removed, activeAccount: hint });
    }
  } catch (error) {
    console.error(
      "[contacts] failed to clear contacts on wallet logout",
      error instanceof Error ? error.message : error,
    );
    throw error;
  }
  clearRecipientCachesForAccounts(params.accountIds);
}

/**
 * Replace wallet (import/create over existing): remove stale contacts from the prior wallet.
 */
export function clearContactsOnWalletReplace(db: DatabaseSync): void {
  try {
    const removed = clearAllContactsDb(db);
    if (process.env.NODE_ENV !== "production") {
      console.debug("[contacts] cleared contacts on wallet replace", { removed });
    }
  } catch (error) {
    console.error(
      "[contacts] failed to clear contacts on wallet replace",
      error instanceof Error ? error.message : error,
    );
    throw error;
  }
  clearSuinsClientCache();
}
