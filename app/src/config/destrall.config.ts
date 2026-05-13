import { isValidSuiAddress } from "@mysten/sui/utils";

/**
 * App-level fee + treasury configuration per chain.
 * Fees are expressed in basis points (100 bps = 1%). Example: "50" = 0.5%.
 */
export const destrallConfig = {
  sui: {
    treasuryAddress: "0x6decd515851e7d6e74b6271f194b8c90bd724348def9b65016d142eee55f118c",
    swapFeeBps: "50",
  },
  solana: {
    treasuryAddress: "",
    swapFeeBps: "50",
  },
} as const;

export type DestrallChainKey = keyof typeof destrallConfig;

export function getChainTreasuryAddress(chain: DestrallChainKey): string {
  return destrallConfig[chain].treasuryAddress.trim();
}

export function getSwapFeeBps(chain: DestrallChainKey): string {
  return destrallConfig[chain].swapFeeBps.trim();
}

/** Returns percent as a number, e.g. 50 bps → 0.5 */
export function getSwapFeePercent(chain: DestrallChainKey): number {
  const bps = Number.parseInt(getSwapFeeBps(chain), 10);
  if (!Number.isFinite(bps) || bps <= 0) return 0;
  return bps / 100;
}

/**
 * True when treasury + fee are usable for Sui swaps.
 * Invalid/missing config disables fees (and logs in development).
 */
export function validateChainFeeConfig(chain: DestrallChainKey): boolean {
  if (chain === "sui") {
    const treasury = getChainTreasuryAddress("sui");
    const bps = Number.parseInt(getSwapFeeBps("sui"), 10);
    if (!treasury) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[destrall] Sui swap fee disabled: treasuryAddress is empty.");
      }
      return false;
    }
    if (!isValidSuiAddress(treasury)) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[destrall] Sui swap fee disabled: treasuryAddress is not a valid Sui address.");
      }
      return false;
    }
    if (!Number.isFinite(bps) || bps < 0 || bps > 10_000) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[destrall] Sui swap fee disabled: swapFeeBps out of range.");
      }
      return false;
    }
    return bps > 0;
  }
  if (chain === "solana") {
    const treasury = getChainTreasuryAddress("solana");
    const bps = Number.parseInt(getSwapFeeBps("solana"), 10);
    if (!treasury || treasury.length < 32) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[destrall] Solana swap fee disabled: treasuryAddress missing or implausible.");
      }
      return false;
    }
    if (!Number.isFinite(bps) || bps < 0 || bps > 10_000) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[destrall] Solana swap fee disabled: swapFeeBps out of range.");
      }
      return false;
    }
    return bps > 0;
  }
  return false;
}
