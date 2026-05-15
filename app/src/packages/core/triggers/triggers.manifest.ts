import type { CorePackageManifest } from "../../runtime/actionTypes";

export const triggersPackageManifest: CorePackageManifest = {
  id: "core.triggers",
  name: "Assistant Triggers",
  version: "1.0.0",
  description:
    "User-pre-approved automation rules for price, schedule, and yield actions. Creation requires explicit approval; execution stays within approved limits.",
  permissions: ["wallet:read", "wallet:prepare_tx", "storage:read", "storage:write"],
  actions: [
    {
      name: "create_trigger",
      description: "Parse and prepare a trigger for user pre-approval (never saves silently).",
      type: "transaction_template",
      requiresConfirmation: true,
      inputSchema: {
        naturalLanguage: "optional_string",
        draftJson: "optional_string",
      },
    },
    {
      name: "list_triggers",
      description: "List automation triggers for the active account.",
      type: "read_state",
      requiresConfirmation: false,
      inputSchema: {},
    },
    {
      name: "pause_trigger",
      description: "Pause an active trigger.",
      type: "read_state",
      requiresConfirmation: false,
      inputSchema: {
        triggerId: "optional_string",
        nameHint: "optional_string",
      },
    },
    {
      name: "resume_trigger",
      description: "Resume a paused trigger.",
      type: "read_state",
      requiresConfirmation: false,
      inputSchema: {
        triggerId: "optional_string",
        nameHint: "optional_string",
      },
    },
    {
      name: "delete_trigger",
      description: "Delete a trigger.",
      type: "read_state",
      requiresConfirmation: false,
      inputSchema: {
        triggerId: "optional_string",
        nameHint: "optional_string",
      },
    },
    {
      name: "execute_due_trigger",
      description: "Internal: evaluate and execute a due trigger within approved limits.",
      type: "transaction_template",
      requiresConfirmation: true,
      inputSchema: {
        triggerId: "string",
      },
    },
  ],
};
