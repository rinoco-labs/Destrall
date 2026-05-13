import { blake2b } from "@noble/hashes/blake2.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { messageWithIntent, toSerializedSignature } from "@mysten/sui/cryptography";

/**
 * Signs serialized transaction bytes for Sui using an Ed25519 secret key (32 bytes).
 * Avoids @mysten/sui Keypair / PublicKey classes per product rules.
 */
export function signSuiTransactionDataEd25519(secretKey32: Uint8Array, transactionDataBytes: Uint8Array): string {
  const digest = blake2b(messageWithIntent("TransactionData", transactionDataBytes), { dkLen: 32 });
  const sig = ed25519.sign(digest, secretKey32);
  const publicKey = ed25519.getPublicKey(secretKey32);
  return toSerializedSignature({
    signature: sig,
    signatureScheme: "ED25519",
    // Duck-typed public key: avoids instantiating @mysten/sui PublicKey / Keypair classes.
    publicKey: { toRawBytes: () => publicKey } as never,
  });
}
