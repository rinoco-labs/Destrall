import { isValidSuiNSName } from "@mysten/sui/utils";
import type { SuiChainEnvironment } from "../../config/chains/sui";
import { resolveSuiNSName } from "../suins/suinsResolutionService";
import { tryParseSuiAddress } from "./contactResolutionService";

/**
 * Resolve a stored recipient fragment (contact address field or pasted value) to a Sui wallet address.
 */
export async function resolveAddressForSend(
  fragment: string,
  suiEnvironment: SuiChainEnvironment,
): Promise<string | null> {
  const trimmed = fragment.trim();
  if (!trimmed) return null;

  const asAddress = tryParseSuiAddress(trimmed);
  if (asAddress) return asAddress;

  if (isValidSuiNSName(trimmed)) {
    const suins = await resolveSuiNSName(trimmed, suiEnvironment);
    return suins?.address ?? null;
  }

  return null;
}
