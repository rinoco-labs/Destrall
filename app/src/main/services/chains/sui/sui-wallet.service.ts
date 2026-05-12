import { mnemonicToSeedSync } from "@scure/bip39";
import { derivePath } from "ed25519-hd-key";
import { ed25519 } from "@noble/curves/ed25519.js";
import { suiAddressFromEd25519PublicKey } from "../../../../shared/suiAddress";
import { suiDerivationPath } from "./derivation-paths";

export type DerivedSuiKeyMaterial = {
  address: string;
  publicKey: string;
  derivationPath: string;
  privateKey: Uint8Array;
};

export function deriveSuiAccountFromMnemonic(
  mnemonic: string,
  accountIndex: number,
): DerivedSuiKeyMaterial {
  const seed = mnemonicToSeedSync(mnemonic, "");
  const seedHex = Buffer.from(seed).toString("hex");
  const derivationPath = suiDerivationPath(accountIndex);
  const { key } = derivePath(derivationPath, seedHex);
  const privateKey = new Uint8Array(key);
  const publicKeyBytes = ed25519.getPublicKey(privateKey);
  return {
    address: suiAddressFromEd25519PublicKey(publicKeyBytes),
    publicKey: Buffer.from(publicKeyBytes).toString("base64"),
    derivationPath,
    privateKey,
  };
}

export function signSuiPersonalMessage(privateKey: Uint8Array, message: Uint8Array): Uint8Array {
  return ed25519.sign(message, privateKey);
}

export function signSuiTransactionBytes(privateKey: Uint8Array, bytes: Uint8Array): Uint8Array {
  return ed25519.sign(bytes, privateKey);
}
