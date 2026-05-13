import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

/** Matches legacy `secret-vault.json` iterations for compatibility with existing installs. */
export const VAULT_PBKDF2_ROUNDS = 210_000;

export type VaultEncryptedPayload = {
  salt: string;
  iv: string;
  tag: string;
  encryptedMnemonic: string;
  updatedAt: number;
};

export function deriveVaultKey(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, VAULT_PBKDF2_ROUNDS, 32, "sha512");
}

export function encryptUtf8WithPassword(plaintext: string, password: string): VaultEncryptedPayload {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveVaultKey(password, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    encryptedMnemonic: encrypted.toString("base64"),
    updatedAt: Date.now(),
  };
}

export function decryptUtf8WithPassword(payload: VaultEncryptedPayload, password: string): string | null {
  try {
    const key = deriveVaultKey(password, Buffer.from(payload.salt, "base64"));
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
