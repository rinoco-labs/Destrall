import {
  GET_WALLET_ADDRESS_ACTION_NAME,
  GET_YIELD_POSITIONS_ACTION_NAME,
  GET_PORTFOLIO_SUMMARY_ACTION_NAME,
  LIST_SWAPPABLE_TOKENS_ACTION_NAME,
  LIST_YIELD_POOLS_ACTION_NAME,
  PREPARE_REBALANCE_ACTION_NAME,
  PREPARE_SEND_ACTION_NAME,
  PREPARE_SWAP_ACTION_NAME,
  PREPARE_YIELD_DEPOSIT_ACTION_NAME,
  PREPARE_YIELD_WITHDRAW_ACTION_NAME,
  SWAP_THEN_DEPOSIT_ACTION_NAME,
} from "./assistantFunctionSchemas";

/** Central map from package capabilities to registered action ids. */
export const AssistantActionIds = {
  prepareSend: PREPARE_SEND_ACTION_NAME,
  getWalletAddress: GET_WALLET_ADDRESS_ACTION_NAME,
  getPortfolioSummary: GET_PORTFOLIO_SUMMARY_ACTION_NAME,
  prepareSwap: PREPARE_SWAP_ACTION_NAME,
  listSwappableTokens: LIST_SWAPPABLE_TOKENS_ACTION_NAME,
  listYieldPools: LIST_YIELD_POOLS_ACTION_NAME,
  getYieldPositions: GET_YIELD_POSITIONS_ACTION_NAME,
  prepareYieldDeposit: PREPARE_YIELD_DEPOSIT_ACTION_NAME,
  prepareYieldWithdraw: PREPARE_YIELD_WITHDRAW_ACTION_NAME,
  swapThenDeposit: SWAP_THEN_DEPOSIT_ACTION_NAME,
  prepareRebalance: PREPARE_REBALANCE_ACTION_NAME,
} as const;

export type StructuredCardKind =
  | "portfolio_summary"
  | "wallet_address"
  | "available_yield_pools"
  | "yield_positions"
  | "swappable_tokens"
  | "send_proposal"
  | "swap_proposal"
  | "navi_deposit_proposal"
  | "navi_withdraw_proposal"
  | "contact_disambiguation"
  | "token_disambiguation"
  | "composite_swap_then_deposit"
  | "rebalance_proposal"
  | "error"
  | "transaction_result"
  | "swap_execution_result"
  | "yield_execution_result"
  | "trigger_proposal"
  | "trigger_list"
  | "time_info"
  | "assistant_capabilities";

export function structuredBlockKind(blockType: string): StructuredCardKind | "other" {
  switch (blockType) {
    case "portfolio_summary":
    case "wallet_address":
    case "available_yield_pools":
    case "yield_positions":
    case "swappable_tokens":
    case "send_proposal":
    case "swap_proposal":
    case "navi_deposit_proposal":
    case "navi_withdraw_proposal":
    case "contact_disambiguation":
    case "token_disambiguation":
    case "composite_swap_then_deposit":
    case "rebalance_proposal":
    case "error":
    case "transaction_result":
    case "swap_execution_result":
    case "yield_execution_result":
    case "trigger_proposal":
    case "trigger_list":
    case "time_info":
    case "assistant_capabilities":
      return blockType;
    default:
      return "other";
  }
}

/** When true, the assistant can answer with cards + short caption without invoking the local LLM. */
export function shouldUseDeterministicAssistantReply(blocks: { type: string }[]): boolean {
  if (blocks.length === 0) return false;
  return blocks.every((b) => structuredBlockKind(b.type) !== "other");
}
