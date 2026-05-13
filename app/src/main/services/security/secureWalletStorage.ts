import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { app } from "electron";
import {
  decryptUtf8WithPassword,
  encryptUtf8WithPassword,
  type VaultEncryptedPayload,
} from "./encryptionService";

const VAULT_FILENAME = "secret-vault.json";

/**
 * Encrypted mnemonic at rest (~/.destrall/secret-vault.json).
 * SQLite holds only public metadata; secrets never go in the DB.
 */
export class SecureWalletStorage {
  private getVaultPath(): string {
    const dir = path.join(app.getPath("home"), ".destrall");
    mkdirSync(dir, { recursive: true });
    return path.join(dir, VAULT_FILENAME);
  }

  hasVault(): boolean {
    return existsSync(this.getVaultPath());
  }

  upsertMnemonic(mnemonic: string, password: string): void {
    const payload = encryptUtf8WithPassword(mnemonic, password);
    writeFileSync(this.getVaultPath(), JSON.stringify(payload), "utf8");
  }

  getMnemonic(password: string): string | null {
    try {
      const raw = readFileSync(this.getVaultPath(), "utf8");
      const payload = JSON.parse(raw) as VaultEncryptedPayload;
      return decryptUtf8WithPassword(payload, password);
    } catch {
      return null;
    }
  }

  removeVault() {
    rmSync(this.getVaultPath(), { force: true });
  }
}
