import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { ChainId, WalletAccount } from "../../../shared/wallet/types";
import {
  TERMS_AND_CONDITIONS_URL,
  TERMS_NOT_ACCEPTED_ERROR,
} from "../../../shared/wallet/terms";
import { runInTransaction } from "../../persistence/database";
import { deriveSuiAccountFromMnemonic } from "../chains/sui/sui-wallet.service";
import type { MnemonicService } from "../../wallet/mnemonicService";
import type { SecureWalletStorage } from "../security/secureWalletStorage";
import { walletSession } from "../../wallet/walletSession";

const ACTIVE_ACCOUNT_KEY = "active_account_id";

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

function rowToAccount(row: AccountRow): WalletAccount {
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

function deriveAccountMetadata(chain: ChainId, mnemonic: string, accountIndex: number) {
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

export type ImportWalletDeps = {
  db: DatabaseSync;
  mnemonicService: MnemonicService;
  vault: SecureWalletStorage;
  session: typeof walletSession;
  supportedChains: ChainId[];
};

export type CreateOrImportArgs = {
  mnemonic: string;
  password: string;
  profileName?: string;
  accountName?: string;
  imported?: boolean;
  termsAccepted: boolean;
};

/**
 * Normalizes and validates BIP-39 input, persists encrypted mnemonic, writes chain metadata
 * for each supported chain, and unlocks the in-memory session for the current process.
 */
export function executeCreateOrImportWallet(deps: ImportWalletDeps, args: CreateOrImportArgs): WalletAccount {
  if (args.termsAccepted !== true) {
    throw new Error(TERMS_NOT_ACCEPTED_ERROR);
  }

  const normalized = deps.mnemonicService.normalize(args.mnemonic);
  if (!deps.mnemonicService.validate(normalized)) {
    throw new Error("Invalid recovery phrase");
  }
  if (!args.password || args.password.length < 8) {
    throw new Error("Wallet password must be at least 8 characters");
  }

  const now = Date.now();
  const profileId = randomUUID();
  const accountIndex = 0;
  const profileName = args.profileName?.trim() || "Wallet 1";
  const accountName = args.accountName?.trim() || "Account 1";

  let accountId = "";
  runInTransaction(deps.db, () => {
    deps.db.prepare(`DELETE FROM wallet_accounts`).run();
    deps.db.prepare(`DELETE FROM wallet_profile`).run();
    deps.db.prepare(`DELETE FROM app_settings WHERE key = ?`).run(ACTIVE_ACCOUNT_KEY);

    deps.db
      .prepare(
        `INSERT INTO wallet_profile (
           id, name, created_at, updated_at,
           accepted_terms, accepted_terms_at, accepted_terms_url
         )
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(profileId, profileName, now, now, now, TERMS_AND_CONDITIONS_URL);

    const insertAccount = deps.db.prepare(
      `INSERT INTO wallet_accounts
       (id, profile_id, chain, name, address, public_key, account_index, derivation_path, icon, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
    );

    for (const chain of deps.supportedChains) {
      const derived = deriveAccountMetadata(chain, normalized, accountIndex);
      const nextAccountId = randomUUID();
      insertAccount.run(
        nextAccountId,
        profileId,
        chain,
        accountName,
        derived.address,
        derived.publicKey,
        accountIndex,
        derived.derivationPath,
        now,
        now,
      );
      if (chain === "sui") {
        accountId = nextAccountId;
      }
    }

    if (!accountId) {
      throw new Error("Failed to create wallet account");
    }

    deps.db
      .prepare(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(ACTIVE_ACCOUNT_KEY, accountId, now);
  });

  deps.vault.upsertMnemonic(normalized, args.password);
  deps.session.setMnemonic(normalized);

  const row = deps.db.prepare(`SELECT * FROM wallet_accounts WHERE id = ?`).get(accountId) as
    | AccountRow
    | undefined;
  if (!row) throw new Error("Wallet account not found after import");
  return rowToAccount(row);
}
