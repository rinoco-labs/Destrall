import type { CorePackageManifest } from "../../runtime/actionTypes";

export const swapAftermathPackageManifest: CorePackageManifest = {
  id: "core.swap.aftermath",
  name: "Aftermath Swap",
  version: "1.0.0",
  description: "Prepare and review Sui swaps via Aftermath Smart Order Router (never executes without explicit approval).",
  permissions: ["wallet:read", "wallet:prepare_tx", "network:fetch"],
  actions: [
    {
      name: "list_swappable_tokens",
      description: "List tokens available to swap through Aftermath Router.",
      type: "read_state",
      requiresConfirmation: false,
      inputSchema: {
        query: "optional_string",
      },
    },
    {
      name: "prepare_swap",
      description: "Prepare a swap transaction for user approval.",
      type: "transaction_template",
      requiresConfirmation: true,
      inputSchema: {
        fromToken: "string",
        toToken: "string",
        amount: "string",
        slippageBps: "optional_number",
      },
    },
    {
      name: "execute_swap",
      description: "Execute an approved swap transaction.",
      type: "transaction_template",
      requiresConfirmation: true,
      inputSchema: {
        proposalId: "string",
      },
    },
  ],
};
