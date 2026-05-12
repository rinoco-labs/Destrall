import { blake2b } from "@noble/hashes/blake2.js";

const SUI_ADDRESS_LEN = 32;
const ED25519_SCHEME_FLAG = 0;

/** Blake2b-256(0x00 || ed25519_pubkey) as `0x` + 64 hex chars (Sui account address). */
export function suiAddressFromEd25519PublicKey(publicKey32: Uint8Array): string {
  if (publicKey32.length !== 32) {
    throw new Error("Ed25519 public key must be 32 bytes");
  }
  const payload = new Uint8Array(33);
  payload[0] = ED25519_SCHEME_FLAG;
  payload.set(publicKey32, 1);
  const digest = blake2b(payload, { dkLen: SUI_ADDRESS_LEN });
  const hex = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}`;
}

/** True if `value` is already a normalized 32-byte Sui address string. */
export function isCanonicalSuiAddressString(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}
