import type { CorePackageManifest } from "../../../runtime/actionTypes";

export const naviYieldPackageManifest: CorePackageManifest = {
  id: "core.yield.navi",
  name: "Navi Yield",
  version: "1.0.0",
  description:
    "List Navi lending pools, read on-chain supply positions, and prepare deposit/withdraw transactions for explicit user approval.",
  permissions: ["wallet:read", "wallet:prepare_tx", "network:fetch"],
  actions: [
    {
      name: "list_yield_pools",
      description: "List available Navi yield pools and APY.",
      type: "read_state",
      requiresConfirmation: false,
      inputSchema: {
        asset: "optional_string",
        sortBy: "optional_string",
        riskProfile: "optional_string",
        limit: "optional_number",
      },
    },
    {
      name: "get_yield_positions",
      description: "Show the user's current Navi yield positions.",
      type: "read_state",
      requiresConfirmation: false,
      inputSchema: {
        asset: "optional_string",
      },
    },
    {
      name: "prepare_yield_deposit",
      description: "Prepare a Navi deposit transaction for user approval.",
      type: "transaction_template",
      requiresConfirmation: true,
      inputSchema: {
        asset: "string",
        amount: "string",
        amountKind: "optional_string",
      },
    },
    {
      name: "prepare_yield_withdraw",
      description: "Prepare a Navi withdraw transaction for user approval.",
      type: "transaction_template",
      requiresConfirmation: true,
      inputSchema: {
        asset: "string",
        amount: "optional_string",
        amountKind: "optional_string",
      },
    },
    {
      name: "execute_yield_action",
      description: "Execute an approved Navi yield transaction.",
      type: "transaction_template",
      requiresConfirmation: true,
      inputSchema: {
        proposalId: "string",
      },
    },
  ],
};
