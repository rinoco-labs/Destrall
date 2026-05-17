import type { IdentifierString } from "@wallet-standard/core";
import {
  SUI_DEVNET_CHAIN,
  SUI_MAINNET_CHAIN,
  SUI_TESTNET_CHAIN,
  SuiSignAndExecuteTransaction,
  SuiSignAndExecuteTransactionBlock,
  SuiSignPersonalMessage,
  SuiSignTransaction,
  SuiSignTransactionBlock,
} from "@mysten/wallet-standard";
import { StandardConnect, StandardDisconnect, StandardEvents } from "@wallet-standard/features";
import type { SuiChainEnvironment } from "../../../config/chains/sui";
import type { WalletStandardAccountRow } from "../../types/walletStandard.types";

export const SUI_WALLET_NAME = "Destrall";

/** Feature identifiers on the wallet object. */
export const SUI_WALLET_FEATURES: readonly IdentifierString[] = [
  StandardConnect,
  StandardDisconnect,
  StandardEvents,
  SuiSignPersonalMessage,
  SuiSignTransaction,
  SuiSignAndExecuteTransaction,
  SuiSignTransactionBlock,
  SuiSignAndExecuteTransactionBlock,
];

/** Per-account features (signing only — not connect/disconnect/events). */
export const SUI_ACCOUNT_FEATURES: readonly IdentifierString[] = [
  SuiSignPersonalMessage,
  SuiSignTransaction,
  SuiSignAndExecuteTransaction,
  SuiSignTransactionBlock,
  SuiSignAndExecuteTransactionBlock,
];

export function suiChainLabelForEnvironment(env: SuiChainEnvironment): IdentifierString {
  switch (env) {
    case "mainnet":
      return SUI_MAINNET_CHAIN;
    case "testnet":
      return SUI_TESTNET_CHAIN;
    case "devnet":
      return SUI_DEVNET_CHAIN;
    default:
      return SUI_MAINNET_CHAIN;
  }
}

export function suiWalletStandardAccountRow(params: {
  address: string;
  publicKeyBytes: Uint8Array;
  chainLabel: IdentifierString;
}): WalletStandardAccountRow {
  return {
    address: params.address,
    publicKey: Array.from(params.publicKeyBytes),
    chains: [params.chainLabel],
    features: [...SUI_ACCOUNT_FEATURES],
  };
}
