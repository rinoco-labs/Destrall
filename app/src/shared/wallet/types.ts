export type ChainId = "sui" | "solana" | "evm";

export type WalletProfile = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  acceptedTerms: boolean;
  acceptedTermsAt: number | null;
  acceptedTermsUrl: string | null;
};

export type WalletAccount = {
  id: string;
  profileId: string;
  chain: ChainId;
  name: string;
  address: string;
  publicKey: string;
  accountIndex: number;
  derivationPath: string;
  icon: string | null;
  color: string | null;
  createdAt: number;
  updatedAt: number;
};

export type WalletRestoreStatus = "idle" | "loading" | "ready" | "error";

export type WalletStatusSnapshot = {
  hasVault: boolean;
  isUnlocked: boolean;
  activeAccountId: string | null;
  profiles: WalletProfile[];
  accounts: WalletAccount[];
};
