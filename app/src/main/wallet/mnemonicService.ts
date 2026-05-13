import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { normalizeMnemonicInput } from "../../shared/mnemonicNormalize";

export class MnemonicService {
  generate(): string {
    return generateMnemonic(wordlist, 128);
  }

  /** Delegates to shared normalization so UI validation matches main-process import. */
  normalize(mnemonic: string): string {
    return normalizeMnemonicInput(mnemonic);
  }

  validate(mnemonic: string): boolean {
    const normalized = this.normalize(mnemonic);
    return normalized.length > 0 && validateMnemonic(normalized, wordlist);
  }

  toSeed(mnemonic: string): Uint8Array {
    return mnemonicToSeedSync(this.normalize(mnemonic), "");
  }
}
