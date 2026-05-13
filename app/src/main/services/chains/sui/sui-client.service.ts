import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { SuiChainEnvironment } from "../../../../config/chains/sui";
import { getSuiRpcUrl } from "../../../../config/chains/sui";

const clientCache = new Map<SuiChainEnvironment, SuiJsonRpcClient>();

/** JSON-RPC client for the configured cluster (v2 SDK: `SuiJsonRpcClient`, not `SuiClient`). */
export function getSuiClientForEnvironment(env: SuiChainEnvironment): SuiJsonRpcClient {
  let client = clientCache.get(env);
  if (!client) {
    const url = getSuiRpcUrl(env);
    client = new SuiJsonRpcClient({ url, network: env });
    clientCache.set(env, client);
  }
  return client;
}

/** Call after switching RPC target so new connections pick up the new URL. */
export function clearSuiClientCache() {
  clientCache.clear();
}
