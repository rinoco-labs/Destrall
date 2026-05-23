import { randomUUID } from "node:crypto";
import type { ChainId, WalletAccount, WalletProfile, WalletStatusSnapshot } from "../../shared/wallet/types";
import { deriveSuiAccountFromMnemonic } from "../services/chains/sui/sui-wallet.service";
import { getDatabase, runInTransaction } from "../persistence/database";
import { MnemonicService } from "./mnemonicService";
import { SecureWalletStorage } from "../services/security/secureWalletStorage";
import { walletSession } from "./walletSession";
import { executeCreateOrImportWallet } from "../services/wallet/importWalletService";

const ACTIVE_ACCOUNT_KEY = "active_account_id";
const SUPPORTED_CHAINS: ChainId[] = ["sui"];

type ProfileRow = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  accepted_terms: number;
  accepted_terms_at: number | null;
  accepted_terms_url: string | null;
};

type AccountRow = {
  id: string;
  profile_id: string;
  chain: ChainId;
  name: string;
  address: string;
  public_key: string;
  account_index: number;
  derivation_path: string;
  icon: string | null;
  color: string | null;
  created_at: number;
  updated_at: number;
};

class WalletService {
  private readonly db = getDatabase();
  private readonly mnemonicService = new MnemonicService();
  private readonly vault = new SecureWalletStorage();

  private rowToProfile(row: ProfileRow): WalletProfile {
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      acceptedTerms: row.accepted_terms === 1,
      acceptedTermsAt: row.accepted_terms_at,
      acceptedTermsUrl: row.accepted_terms_url,
    };
  }

  private rowToAccount(row: AccountRow): WalletAccount {
    return {
      id: row.id,
      profileId: row.profile_id,
      chain: row.chain,
      name: row.name,
      address: row.address,
      publicKey: row.public_key,
      accountIndex: row.account_index,
      derivationPath: row.derivation_path,
      icon: row.icon,
      color: row.color,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private listProfiles(): WalletProfile[] {
    const rows = this.db
      .prepare(`SELECT * FROM wallet_profile ORDER BY created_at ASC`)
      .all() as ProfileRow[];
    return rows.map((row) => this.rowToProfile(row));
  }

  private listAccounts(): WalletAccount[] {
    const rows = this.db
      .prepare(`SELECT * FROM wallet_accounts ORDER BY account_index ASC, created_at ASC`)
      .all() as AccountRow[];
    return rows.map((row) => this.rowToAccount(row));
  }

  private getAccountById(accountId: string): WalletAccount {
    const row = this.db
      .prepare(`SELECT * FROM wallet_accounts WHERE id = ?`)
      .get(accountId) as AccountRow | undefined;
    if (!row) throw new Error("Account not found");
    return this.rowToAccount(row);
  }

  private getActiveAccountId(): string | null {
    const row = this.db
      .prepare(`SELECT value FROM app_settings WHERE key = ?`)
      .get(ACTIVE_ACCOUNT_KEY) as { value: string } | undefined;
    return row?.value ?? null;
  }

  private setActiveAccountId(accountId: string) {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(ACTIVE_ACCOUNT_KEY, accountId, now);
  }

  getWalletAccount(accountId: string): WalletAccount | null {
    try {
      return this.getAccountById(accountId);
    } catch {
      return null;
    }
  }

  getStatus(): WalletStatusSnapshot {
    const profiles = this.listProfiles();
    const accounts = this.listAccounts();
    let activeAccountId = this.getActiveAccountId();
    const activeExists = activeAccountId
      ? accounts.some((account) => account.id === activeAccountId)
      : false;
    if (!activeExists) {
      if (accounts[0]) {
        activeAccountId = accounts[0].id;
        this.setActiveAccountId(activeAccountId);
      } else {
        activeAccountId = null;
      }
    }
    return {
      hasVault: this.vault.hasVault(),
      isUnlocked: walletSession.isUnlocked(),
      activeAccountId,
      profiles,
      accounts,
    };
  }

  previewMnemonic() {
    return this.mnemonicService.generate();
  }

  createOrImportWallet(args: {
    mnemonic: string;
    password: string;
    profileName?: string;
    accountName?: string;
    imported?: boolean;
    termsAccepted: boolean;
  }): WalletAccount {
    void args.imported;
    return executeCreateOrImportWallet(
      {
        db: this.db,
        mnemonicService: this.mnemonicService,
        vault: this.vault,
        session: walletSession,
        supportedChains: SUPPORTED_CHAINS,
      },
      args,
    );
  }

  createAdditionalAccount(args: { name: string }): WalletAccount {
    const mnemonic = walletSession.getMnemonic();
    if (!mnemonic) {
      throw new Error("Wallet session is locked. Unlock your wallet to add accounts.");
    }

    const profile = this.db
      .prepare(`SELECT id FROM wallet_profile ORDER BY created_at ASC LIMIT 1`)
      .get() as { id: string } | undefined;
    if (!profile) throw new Error("Wallet profile not found");

    const maxRow = this.db
      .prepare(`SELECT MAX(account_index) as maxIdx FROM wallet_accounts WHERE profile_id = ?`)
      .get(profile.id) as { maxIdx: number | null };
    const nextIndex = (maxRow.maxIdx ?? -1) + 1;
    const now = Date.now();
    const trimmedName = args.name.trim();
    if (!trimmedName) throw new Error("Account name is required");

    let accountId = "";
    runInTransaction(this.db, () => {
      const insertAccount = this.db.prepare(
        `INSERT INTO wallet_accounts
         (id, profile_id, chain, name, address, public_key, account_index, derivation_path, icon, color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
      );

      for (const chain of SUPPORTED_CHAINS) {
        const derived = this.deriveAccount(chain, mnemonic, nextIndex);
        const nextAccountId = randomUUID();
        insertAccount.run(
          nextAccountId,
          profile.id,
          chain,
          trimmedName,
          derived.address,
          derived.publicKey,
          nextIndex,
          derived.derivationPath,
          now,
          now,
        );
        if (chain === "sui") {
          accountId = nextAccountId;
        }
      }

      if (!accountId) {
        throw new Error("Failed to create account");
      }
      this.setActiveAccountId(accountId);
    });
    return this.getAccountById(accountId);
  }

  switchAccount(accountId: string) {
    this.getAccountById(accountId);
    this.setActiveAccountId(accountId);
    return { activeAccountId: accountId };
  }

  renameAccount(accountId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Account name is required");
    const account = this.getAccountById(accountId);
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE wallet_accounts
         SET name = ?, updated_at = ?
         WHERE profile_id = ? AND account_index = ?`,
      )
      .run(trimmed, now, account.profileId, account.accountIndex);
    return this.getAccountById(accountId);
  }

  updateAccountIcon(accountId: string, icon?: string | null, color?: string | null) {
    const account = this.getAccountById(accountId);
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE wallet_accounts
         SET icon = ?, color = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(icon ?? account.icon, color ?? account.color, now, accountId);
    return this.getAccountById(accountId);
  }

  viewSeedPhrase(password: string): string {
    const value = this.vault.getMnemonic(password);
    if (!value) throw new Error("Incorrect wallet password");
    const normalized = this.mnemonicService.normalize(value);
    walletSession.setMnemonic(normalized);
    return normalized;
  }

  unlockSessionWithPassword(password: string) {
    const value = this.vault.getMnemonic(password);
    if (!value) throw new Error("Incorrect wallet password");
    walletSession.setMnemonic(this.mnemonicService.normalize(value));
  }

  lockSession() {
    walletSession.clear();
  }

  disconnect() {
    walletSession.clear();
    this.vault.removeVault();
    runInTransaction(this.db, () => {
      this.db.exec(`DELETE FROM wallet_accounts`);
      this.db.exec(`DELETE FROM wallet_profile`);
      this.db.exec(`DELETE FROM app_settings`);
    });
  }

  private deriveAccount(chain: ChainId, mnemonic: string, accountIndex: number) {
    if (chain === "sui") {
      const derived = deriveSuiAccountFromMnemonic(mnemonic, accountIndex);
      return {
        address: derived.address,
        publicKey: derived.publicKey,
        derivationPath: derived.derivationPath,
      };
    }
    throw new Error(`Unsupported chain: ${chain}`);
  }
}

export const walletService = new WalletService();
