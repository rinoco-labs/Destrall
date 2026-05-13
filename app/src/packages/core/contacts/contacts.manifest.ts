import type { CorePackageManifest } from "../../runtime/actionTypes";

export const contactsPackageManifest: CorePackageManifest = {
  id: "core.contacts",
  name: "Contacts",
  version: "1.0.0",
  description: "Read scoped contacts for assistant workflows.",
  permissions: ["contacts:read"],
  actions: [
    {
      name: "search_contacts",
      description: "Search contacts visible to the active account (read-only).",
      type: "read_state",
      requiresConfirmation: false,
      inputSchema: {},
    },
  ],
};
