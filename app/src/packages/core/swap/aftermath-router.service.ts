import type { SuiChainEnvironment } from "../../../config/chains/sui";
import { suiAftermathSwapService } from "../../../main/services/chains/sui/sui-aftermath-swap.service";

/**
 * Aftermath Router reads (main process). Used for route quotes, tx build, and validating that coin types
 * are router-supported — not for inferring which coins the user owns (spend assets come from wallet balances).
 */
export async function fetchAftermathSupportedCoinTypes(
  env: SuiChainEnvironment,
  filter?: string,
): Promise<string[]> {
  return suiAftermathSwapService.getSupportedCoinTypes(env, filter);
}
