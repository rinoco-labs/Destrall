/**
 * JSON-schema style definitions for future local LLM function calling (e.g. node-llama-cpp).
 * Keep in sync with package manifests — the assistant runtime validates against manifests too.
 */

export const PREPARE_SEND_ACTION_NAME = "core.wallet.send.prepare_send";

export const GET_WALLET_ADDRESS_ACTION_NAME = "core.wallet.send.get_wallet_address";

export const GET_PORTFOLIO_SUMMARY_ACTION_NAME = "core.portfolio.get_summary";

export const LIST_SWAPPABLE_TOKENS_ACTION_NAME = "core.swap.aftermath.list_swappable_tokens";

export const PREPARE_SWAP_ACTION_NAME = "core.swap.aftermath.prepare_swap";

export const LIST_YIELD_POOLS_ACTION_NAME = "core.yield.navi.list_yield_pools";

export const GET_YIELD_POSITIONS_ACTION_NAME = "core.yield.navi.get_yield_positions";

export const PREPARE_YIELD_DEPOSIT_ACTION_NAME = "core.yield.navi.prepare_yield_deposit";

export const PREPARE_YIELD_WITHDRAW_ACTION_NAME = "core.yield.navi.prepare_yield_withdraw";

export const SWAP_THEN_DEPOSIT_ACTION_NAME = "core.composite.swap_then_deposit";

export const PREPARE_REBALANCE_ACTION_NAME = "core.rebalance.prepare_rebalance";

export const CREATE_TRIGGER_ACTION_NAME = "core.triggers.create_trigger";
export const LIST_TRIGGERS_ACTION_NAME = "core.triggers.list_triggers";
export const PAUSE_TRIGGER_ACTION_NAME = "core.triggers.pause_trigger";
export const RESUME_TRIGGER_ACTION_NAME = "core.triggers.resume_trigger";
export const DELETE_TRIGGER_ACTION_NAME = "core.triggers.delete_trigger";

export const GET_CURRENT_TIME_ACTION_NAME = "core.time.get_current_time";

export const prepareSendFunctionSchema = {
  name: PREPARE_SEND_ACTION_NAME,
  description:
    "Prepare a Sui token transfer for user review. Never executes on-chain; the user must approve in the transaction card.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      token: {
        type: "string",
        description: "Token symbol to send (e.g. SUI, USDC, WAL).",
      },
      amount: {
        type: "string",
        description: "Human-readable amount (decimal string).",
      },
      recipient: {
        type: "string",
        description:
          "Recipient: full Sui address (0x…), saved contact name, registered SuiNS name (e.g. name.sui), another account name, or 'my other wallet' for intra-wallet transfers.",
      },
    },
    required: ["token", "amount", "recipient"],
  },
} as const;

export const listSwappableTokensFunctionSchema = {
  name: LIST_SWAPPABLE_TOKENS_ACTION_NAME,
  description:
    "List Sui tokens the user can receive in a swap (Destrall swappable-token registry). Only Sui is supported for this list today. Read-only.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      query: {
        type: "string",
        description: "Optional filter (symbol, name, or coin-type fragment).",
      },
    },
    required: [],
  },
} as const;

export const prepareSwapFunctionSchema = {
  name: PREPARE_SWAP_ACTION_NAME,
  description:
    "Prepare a token swap for user review via Aftermath Router. Never executes on-chain without explicit user approval on the swap card.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      fromToken: {
        type: "string",
        description: "Token symbol or identifier to sell (e.g. SUI, USDC).",
      },
      toToken: {
        type: "string",
        description: "Token symbol or identifier to buy.",
      },
      amount: {
        type: "string",
        description: "Human-readable amount of fromToken to swap (decimal string).",
      },
      slippageBps: {
        type: "number",
        description:
          "Optional max slippage in basis points only. 100 = 1%, 50 = 0.5%. Never pass 1 for 1% — use 100.",
      },
    },
    required: ["fromToken", "toToken", "amount"],
  },
} as const;

export const listYieldPoolsFunctionSchema = {
  name: LIST_YIELD_POOLS_ACTION_NAME,
  description:
    "List available Navi lending pools with live APY on Sui mainnet (read-only). Use when the user asks about available yield, savings pools, APYs, or where they can earn — 'yield' and 'savings' mean Navi. Optional risk-based sorting.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      asset: { type: "string", description: "Optional filter by asset symbol." },
      sortBy: { type: "string", description: "Optional: apy | tvl | risk" },
      limit: { type: "number", description: "Optional max number of pools to return (1–50)." },
      riskProfile: {
        type: "string",
        description: "Optional: conservative | balanced | aggressive | max_yield",
      },
    },
    required: [],
  },
} as const;

export const getYieldPositionsFunctionSchema = {
  name: GET_YIELD_POSITIONS_ACTION_NAME,
  description:
    "List the user's current Navi supply positions on Sui mainnet (read-only). Use when they ask about my yield/savings positions, what they have in yield or savings, or open Navi positions — not for available pools.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      asset: { type: "string", description: "Optional filter by asset symbol." },
    },
    required: [],
  },
} as const;

export const prepareYieldDepositFunctionSchema = {
  name: PREPARE_YIELD_DEPOSIT_ACTION_NAME,
  description:
    "Prepare a Navi deposit transaction for user review when they want to deposit into yield, savings, or Navi. Never executes without explicit approval on the Navi card.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      asset: { type: "string", description: "Asset symbol (e.g. USDC, SUI)." },
      amount: { type: "string", description: "Human amount or percentage string when amountKind is percentage." },
      amountKind: { type: "string", description: "absolute (default) or percentage" },
    },
    required: ["asset", "amount"],
  },
} as const;

export const prepareYieldWithdrawFunctionSchema = {
  name: PREPARE_YIELD_WITHDRAW_ACTION_NAME,
  description:
    "Prepare a Navi withdraw transaction for user review when they want to withdraw from yield, savings, or Navi. Resolves against Navi positions, not wallet balances. Never executes without explicit approval.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      asset: { type: "string", description: "Asset symbol (e.g. USDC, SUI)." },
      amount: { type: "string", description: "Human amount; omit when amountKind is all." },
      amountKind: { type: "string", description: "absolute | percentage | all | interest" },
    },
    required: ["asset"],
  },
} as const;

export const prepareRebalanceFunctionSchema = {
  name: PREPARE_REBALANCE_ACTION_NAME,
  description:
    "Build a rebalance plan from natural-language target weights (read-only plan card; swaps are prepared separately).",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      distributionText: {
        type: "string",
        description: 'User text with percents, e.g. "30% SUI, 10% WAL, 20% DEEP and the rest in USDC".',
      },
    },
    required: ["distributionText"],
  },
} as const;

export const swapThenDepositFunctionSchema = {
  name: SWAP_THEN_DEPOSIT_ACTION_NAME,
  description:
    "Prepare staged swap then Navi deposit when the wallet holds a different asset than the pool (swap first, deposit after confirmation).",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      spendSymbol: { type: "string", description: "Token symbol to spend from the wallet (e.g. USDC)." },
      poolAssetSymbol: { type: "string", description: "Navi pool / supply asset symbol (e.g. DEEP)." },
      amount: { type: "string", description: "Human amount or percentage string." },
      amountKind: { type: "string", description: "absolute | percentage" },
    },
    required: ["spendSymbol", "poolAssetSymbol", "amount", "amountKind"],
  },
} as const;

export const createTriggerFunctionSchema = {
  name: CREATE_TRIGGER_ACTION_NAME,
  description:
    "Prepare an automation trigger proposal card for explicit user pre-approval. Never saves or executes silently. Use for when/if/at/every + action phrasing. Examples: 'when SUI is at 0.8 USD sell 1 SUI' → price trigger; 'sell 1 SUI at 3:10 PM' → time trigger; 'when SUI drops to 0.69 USD buy 10 USDC worth of SUI' → price buy trigger. Do not explain triggers — create the proposal or ask only for missing required fields.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      naturalLanguage: {
        type: "string",
        description:
          "User description of the trigger, e.g. 'when SUI is at 0.8 USD sell 1 SUI', 'sell 1 SUI at 3:10 PM', or 'deposit 20 USDC into yield every day at 10am'.",
      },
    },
    required: ["naturalLanguage"],
  },
} as const;

export const listTriggersFunctionSchema = {
  name: LIST_TRIGGERS_ACTION_NAME,
  description: "List the user's automation triggers for the active account.",
  parameters: { type: "object", additionalProperties: false, properties: {}, required: [] },
} as const;

export const assistantToolDefinitionsForModel = [
  prepareSendFunctionSchema,
  listSwappableTokensFunctionSchema,
  prepareSwapFunctionSchema,
  listYieldPoolsFunctionSchema,
  getYieldPositionsFunctionSchema,
  prepareYieldDepositFunctionSchema,
  prepareYieldWithdrawFunctionSchema,
  swapThenDepositFunctionSchema,
  prepareRebalanceFunctionSchema,
  createTriggerFunctionSchema,
  listTriggersFunctionSchema,
  {
    name: GET_CURRENT_TIME_ACTION_NAME,
    description: "Return the user's current local time, timezone, and UTC time.",
    parameters: { type: "object", additionalProperties: false, properties: {}, required: [] },
  },
];
