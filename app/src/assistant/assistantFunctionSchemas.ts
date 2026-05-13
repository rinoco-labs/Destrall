/**
 * JSON-schema style definitions for future local LLM function calling (e.g. node-llama-cpp).
 * Keep in sync with package manifests — the assistant runtime validates against manifests too.
 */

export const PREPARE_SEND_ACTION_NAME = "core.wallet.send.prepare_send";

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

export const assistantToolDefinitionsForModel = [prepareSendFunctionSchema];
