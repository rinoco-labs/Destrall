import { SuinsClient } from "@mysten/suins";
import { isValidSuiNSName, normalizeSuiNSName } from "@mysten/sui/utils";
import type { SuiChainEnvironment } from "../../config/chains/sui";
import { getSuiClientForEnvironment } from "../../main/services/chains/sui/sui-client.service";
import { tryParseSuiAddress } from "../contacts/contactResolutionService";

const suinsClients = new Map<SuiChainEnvironment, SuinsClient>();

/** SuiNS registry is deployed on mainnet and testnet only. */
function suinsNetworkFor(env: SuiChainEnvironment): "mainnet" | "testnet" {
  return env === "mainnet" ? "mainnet" : "testnet";
}

function getSuinsClient(env: SuiChainEnvironment): SuinsClient {
  let client = suinsClients.get(env);
  if (!client) {
    client = new SuinsClient({
      client: getSuiClientForEnvironment(env),
      network: suinsNetworkFor(env),
    });
    suinsClients.set(env, client);
  }
  return client;
}

export function clearSuinsClientCache() {
  suinsClients.clear();
}

/**
 * Resolve a SuiNS name (e.g. `demo.sui`, `alice@node`) to a wallet address.
 * Returns null when the name is not registered or has no target address.
 */
export async function resolveSuiNSName(
  name: string,
  env: SuiChainEnvironment,
): Promise<{ displayName: string; address: string } | null> {
  const trimmed = name.trim().replace(/[.,!?;:]+$/, "");
  if (!trimmed || !isValidSuiNSName(trimmed)) {
    return null;
  }

  const dotName = normalizeSuiNSName(trimmed, "dot");
  const record = await getSuinsClient(env).getNameRecord(dotName);
  if (!record?.targetAddress) {
    return null;
  }

  const address = tryParseSuiAddress(record.targetAddress);
  if (!address) {
    return null;
  }

  return { displayName: dotName, address };
}
