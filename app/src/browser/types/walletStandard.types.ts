import type { WalletAccount } from "@wallet-standard/core";
import type {
  SuiSignAndExecuteTransactionOutput,
  SuiSignPersonalMessageOutput,
  SignedTransaction,
} from "@mysten/wallet-standard";

/** Serializable wallet account row sent to the dapp WebView (publicKey as bytes). */
export type WalletStandardAccountRow = Pick<WalletAccount, "address" | "chains" | "features"> & {
  publicKey: number[];
};

export type WalletStandardConnectResult = {
  accounts: WalletStandardAccountRow[];
};

export type SuiSignPersonalMessageResult = SuiSignPersonalMessageOutput;
export type SuiSignTransactionResult = SignedTransaction;
export type SuiSignAndExecuteResult = SuiSignAndExecuteTransactionOutput;
