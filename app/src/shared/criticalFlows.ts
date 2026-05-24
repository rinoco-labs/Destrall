/** Wallet-sensitive UI flows that must finish before opening an update installer. */
export const CRITICAL_FLOW_TYPES = [
  "creating_wallet",
  "importing_wallet",
  "viewing_seed_phrase",
  "entering_seed_phrase",
  "signing_transaction",
  "approving_swap_proposal",
  "approving_send_proposal",
  "approving_yield_proposal",
  "approving_rebalance_proposal",
  "approving_trigger_proposal",
  "approving_composite_proposal",
  "browser_dapp_request",
] as const;

export type CriticalFlowType = (typeof CRITICAL_FLOW_TYPES)[number];

export const CRITICAL_FLOW_BLOCKED_MESSAGE =
  "Finish your current wallet action before opening the update installer.";
