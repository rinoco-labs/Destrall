import type { CorePackageManifest } from "../../runtime/actionTypes";

export const walletSendPackageManifest: CorePackageManifest = {
  id: "core.wallet.send",
  name: "Wallet Send",
  version: "1.0.0",
  description: "Prepare Sui token transfers for explicit user approval (never executes on-chain by itself).",
  permissions: ["wallet:read", "wallet:prepare_tx", "contacts:read"],
  actions: [
    {
      name: "prepare_send",
      description: "Prepare a token transfer for user approval.",
      type: "transaction_template",
      requiresConfirmation: true,
      inputSchema: {
        token: "string",
        amount: "string",
        recipient: "string",
      },
    },
  ],
};
