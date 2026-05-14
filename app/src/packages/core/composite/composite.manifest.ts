import type { CorePackageManifest } from "../../runtime/actionTypes";

export const compositePackageManifest: CorePackageManifest = {
  id: "core.composite",
  name: "Composite flows",
  version: "1.0.0",
  description: "Prepare staged multi-step flows such as swap then Navi deposit (prepare-only; user approves each on-chain step).",
  permissions: ["wallet:read", "wallet:prepare_tx", "network:fetch"],
  actions: [
    {
      name: "swap_then_deposit",
      description: "Prepare swap then Navi deposit when spend asset differs from pool asset (staged approvals).",
      type: "read_state",
      requiresConfirmation: false,
      inputSchema: {
        spendSymbol: "string",
        poolAssetSymbol: "string",
        amount: "string",
        amountKind: "string",
      },
    },
  ],
};
