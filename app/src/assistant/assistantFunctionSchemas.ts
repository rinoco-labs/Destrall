/**
 * JSON-schema style definitions for future local LLM function calling (e.g. node-llama-cpp).
 * Keep in sync with package manifests — the assistant runtime validates against manifests too.
 */

export const PREPARE_SEND_ACTION_NAME = "core.wallet.send.prepare_send";

export const LIST_SWAPPABLE_TOKENS_ACTION_NAME = "core.swap.aftermath.list_swappable_tokens";

export const PREPARE_SWAP_ACTION_NAME = "core.swap.aftermath.prepare_swap";

export const LIST_YIELD_POOLS_ACTION_NAME = "core.yield.navi.list_yield_pools";

export const GET_YIELD_POSITIONS_ACTION_NAME = "core.yield.navi.get_yield_positions";

export const PREPARE_YIELD_DEPOSIT_ACTION_NAME = "core.yield.navi.prepare_yield_deposit";

export const PREPARE_YIELD_WITHDRAW_ACTION_NAME = "core.yield.navi.prepare_yield_withdraw";

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
          "Recipient Sui address, contact name, another account name, or the phrase 'my other wallet' for intra-wallet transfers.",
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
        description: "Optional max slippage in basis points (e.g. 50 = 0.5%).",
      },
    },
    required: ["fromToken", "toToken", "amount"],
  },
} as const;

export const listYieldPoolsFunctionSchema = {
  name: LIST_YIELD_POOLS_ACTION_NAME,
  description:
    "List Navi lending pools with live APY on Sui mainnet (read-only). Use for yield pool questions. Optional risk-based sorting.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      asset: { type: "string", description: "Optional filter by asset symbol." },
      sortBy: { type: "string", description: "Optional: apy | tvl | risk" },
      riskProfile: { type: "string", description: "Optional: conservative | balanced | aggressive" },
    },
    required: [],
  },
} as const;

export const getYieldPositionsFunctionSchema = {
  name: GET_YIELD_POSITIONS_ACTION_NAME,
  description: "List the user's Navi supply positions on Sui mainnet (read-only).",
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
    "Prepare a Navi deposit transaction for user review. Never executes without explicit approval on the Navi card.",
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
    "Prepare a Navi withdraw transaction for user review. Never executes without explicit approval on the Navi card.",
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

export const assistantToolDefinitionsForModel = [
  prepareSendFunctionSchema,
  listSwappableTokensFunctionSchema,
  prepareSwapFunctionSchema,
  listYieldPoolsFunctionSchema,
  getYieldPositionsFunctionSchema,
  prepareYieldDepositFunctionSchema,
  prepareYieldWithdrawFunctionSchema,
];
