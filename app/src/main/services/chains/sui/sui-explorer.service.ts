import type { SuiChainEnvironment } from "../../../../config/chains/sui";
import { getSuiNetworkDefinition } from "../../../../config/chains/sui";

export function getAddressExplorerUrl(env: SuiChainEnvironment, address: string): string {
  const base = getSuiNetworkDefinition(env).explorerBaseUrl;
  return `${base}/address/${encodeURIComponent(address)}`;
}

export function getTransactionExplorerUrl(env: SuiChainEnvironment, digest: string): string {
  const base = getSuiNetworkDefinition(env).explorerBaseUrl;
  return `${base}/tx/${encodeURIComponent(digest)}`;
}
