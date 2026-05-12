import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import path from "node:path";
import { app } from "electron";

type SecretFile = {
  salt: string;
  iv: string;
  tag: string;
  encryptedMnemonic: string;
  updatedAt: number;
};

const PBKDF2_ROUNDS = 210_000;

function deriveKey(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, PBKDF2_ROUNDS, 32, "sha512");
}

export class SecretVault {
  private getVaultPath(): string {
    const dir = path.join(app.getPath("home"), ".destrall");
    mkdirSync(dir, { recursive: true });
    return path.join(dir, "secret-vault.json");
  }

  hasVault(): boolean {
    return existsSync(this.getVaultPath());
  }

  upsertMnemonic(mnemonic: string, password: string): void {
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = deriveKey(password, salt);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(mnemonic, "utf8"), cipher.final()]);
    const payload: SecretFile = {
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      encryptedMnemonic: encrypted.toString("base64"),
      updatedAt: Date.now(),
    };
    writeFileSync(this.getVaultPath(), JSON.stringify(payload), "utf8");
  }

  getMnemonic(password: string): string | null {
    try {
      const payload = JSON.parse(readFileSync(this.getVaultPath(), "utf8")) as SecretFile;
      const key = deriveKey(password, Buffer.from(payload.salt, "base64"));
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
      decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(payload.encryptedMnemonic, "base64")),
        decipher.final(),
      ]);
      return decrypted.toString("utf8");
    } catch {
      return null;
    }
  }

  removeVault() {
    rmSync(this.getVaultPath(), { force: true });
  }
}
