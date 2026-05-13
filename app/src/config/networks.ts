import type { ChainId } from "../shared/wallet/types";
import type { SuiChainEnvironment } from "./chains/sui";
import { SUI_NETWORKS } from "./chains/sui";

export type SupportedChainDescriptor = {
  id: ChainId;
  label: string;
  /** Environments available for this chain (Sui-only for now) */
  environments: SuiChainEnvironment[];
};

export const SUPPORTED_CHAIN_DESCRIPTORS: SupportedChainDescriptor[] = [
  {
    id: "sui",
    label: "Sui",
    environments: ["mainnet", "testnet", "devnet"],
  },
];

export function isSuiEnvironment(value: string): value is SuiChainEnvironment {
  return value === "mainnet" || value === "testnet" || value === "devnet";
}

export function listSuiEnvironments(): SuiChainEnvironment[] {
  return Object.keys(SUI_NETWORKS) as SuiChainEnvironment[];
}
