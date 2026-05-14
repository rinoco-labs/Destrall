import type { CorePackageManifest } from "../../runtime/actionTypes";

export const portfolioPackageManifest: CorePackageManifest = {
  id: "core.portfolio",
  name: "Portfolio reads",
  version: "1.0.0",
  description: "Read-only portfolio summaries for the assistant.",
  permissions: ["wallet:read"],
  actions: [
    {
      name: "get_summary",
      description: "Return the current account token balances as a portfolio summary card.",
      type: "read_state",
      requiresConfirmation: false,
      inputSchema: {},
    },
  ],
};
