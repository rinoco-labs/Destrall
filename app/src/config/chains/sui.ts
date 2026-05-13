/**
 * Centralized Sui network definitions. All RPC and explorer URLs for Sui must originate here.
 */
export type SuiChainEnvironment = "mainnet" | "testnet" | "devnet";

export type SuiNetworkDefinition = {
  id: SuiChainEnvironment;
  rpcUrl: string;
  explorerBaseUrl: string;
  /** Human-readable chain label for UI / assistant context */
  chainIdLabel: string;
};

export const SUI_NETWORKS: Record<SuiChainEnvironment, SuiNetworkDefinition> = {
  mainnet: {
    id: "mainnet",
    rpcUrl: "https://fullnode.mainnet.sui.io:443",
    explorerBaseUrl: "https://suiscan.xyz/mainnet",
    chainIdLabel: "sui:mainnet",
  },
  testnet: {
    id: "testnet",
    rpcUrl: "https://fullnode.testnet.sui.io:443",
    explorerBaseUrl: "https://suiscan.xyz/testnet",
    chainIdLabel: "sui:testnet",
  },
  devnet: {
    id: "devnet",
    rpcUrl: "https://fullnode.devnet.sui.io:443",
    explorerBaseUrl: "https://suiscan.xyz/devnet",
    chainIdLabel: "sui:devnet",
  },
};

export const SUI_COIN_TYPE = "0x2::sui::SUI";

export function getSuiNetworkDefinition(env: SuiChainEnvironment): SuiNetworkDefinition {
  return SUI_NETWORKS[env];
}

export function getSuiRpcUrl(env: SuiChainEnvironment): string {
  return SUI_NETWORKS[env].rpcUrl;
}
