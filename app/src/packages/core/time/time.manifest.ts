import type { CorePackageManifest } from "../../runtime/actionTypes";

export const timePackageManifest: CorePackageManifest = {
  id: "core.time",
  name: "Time & scheduling",
  version: "1.0.0",
  description: "Read device-local time and timezone for assistant scheduling (read-only).",
  permissions: ["storage:read"],
  actions: [
    {
      name: "get_current_time",
      description: "Return current local time, timezone, and UTC time for the user.",
      type: "read_state",
      requiresConfirmation: false,
      inputSchema: {},
    },
  ],
};
