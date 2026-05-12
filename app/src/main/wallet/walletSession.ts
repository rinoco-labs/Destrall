class WalletSession {
  private mnemonic: string | null = null;

  setMnemonic(mnemonic: string) {
    this.mnemonic = mnemonic;
  }

  clear() {
    this.mnemonic = null;
  }

  getMnemonic(): string | null {
    return this.mnemonic;
  }

  isUnlocked(): boolean {
    return this.mnemonic != null;
  }
}

export const walletSession = new WalletSession();
