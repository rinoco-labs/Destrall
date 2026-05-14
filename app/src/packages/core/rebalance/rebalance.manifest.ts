import type { CorePackageManifest } from "../../runtime/actionTypes";

export const rebalancePackageManifest: CorePackageManifest = {
  id: "core.rebalance",
  name: "Portfolio rebalance",
  version: "1.0.0",
  description: "Prepare read-only rebalance plans from target allocation text (swaps are prepared separately for approval).",
  permissions: ["wallet:read"],
  actions: [
    {
      name: "prepare_rebalance",
      description: "Build a rebalance swap plan from natural-language target weights.",
      type: "read_state",
      requiresConfirmation: false,
      inputSchema: {
        distributionText: "string",
      },
    },
  ],
};
