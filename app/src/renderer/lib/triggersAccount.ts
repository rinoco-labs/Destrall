import type { WalletStoreState } from "@/stores/walletStore";
import { resolveTriggersAccountId } from "../../shared/triggers/resolveTriggersAccountId";

/** Account id used for trigger list/actions — matches wallet fallback when active id is unset. */
export function getTriggersAccountId(
  state: Pick<WalletStoreState, "activeAccountId" | "accounts">,
): string | null {
  return resolveTriggersAccountId(state.activeAccountId, state.accounts);
}
