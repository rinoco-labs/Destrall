/**
 * JSON-schema style definitions for future local LLM function calling (e.g. node-llama-cpp).
 * Keep in sync with package manifests — the assistant runtime validates against manifests too.
 */

export const PREPARE_SEND_ACTION_NAME = "core.wallet.send.prepare_send";

export const LIST_SWAPPABLE_TOKENS_ACTION_NAME = "core.swap.aftermath.list_swappable_tokens";

export const PREPARE_SWAP_ACTION_NAME = "core.swap.aftermath.prepare_swap";

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
    "List tokens that can be traded through the Aftermath Smart Order Router on the active Sui network. Read-only.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      query: {
        type: "string",
        description: "Optional filter string to narrow supported coins (symbol fragment).",
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

export const assistantToolDefinitionsForModel = [
  prepareSendFunctionSchema,
  listSwappableTokensFunctionSchema,
  prepareSwapFunctionSchema,
];
