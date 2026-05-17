import {
  SOLANA_DEVNET_CHAIN,
  SOLANA_MAINNET_CHAIN,
  SOLANA_TESTNET_CHAIN,
} from "@solana/wallet-standard-chains";
import {
  SolanaSignAndSendTransaction,
  SolanaSignMessage,
  SolanaSignTransaction,
} from "@solana/wallet-standard-features";

/** Solana browser adapter — disabled until fully implemented. */
export const SOLANA_BROWSER_ENABLED = false;

/** Reserved for a future Solana wallet-standard provider. */
export const SOLANA_WALLET_FEATURE_IDS = [
  SolanaSignMessage,
  SolanaSignTransaction,
  SolanaSignAndSendTransaction,
] as const;

export const SOLANA_CHAIN_LABELS = {
  mainnet: SOLANA_MAINNET_CHAIN,
  testnet: SOLANA_TESTNET_CHAIN,
  devnet: SOLANA_DEVNET_CHAIN,
} as const;
