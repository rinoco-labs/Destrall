import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

export class MnemonicService {
  generate(): string {
    return generateMnemonic(wordlist, 128);
  }

  normalize(mnemonic: string): string {
    return mnemonic.trim().split(/\s+/).filter(Boolean).join(" ").toLowerCase();
  }

  validate(mnemonic: string): boolean {
    const normalized = this.normalize(mnemonic);
    return normalized.length > 0 && validateMnemonic(normalized, wordlist);
  }

  toSeed(mnemonic: string): Uint8Array {
    return mnemonicToSeedSync(this.normalize(mnemonic), "");
  }
}
