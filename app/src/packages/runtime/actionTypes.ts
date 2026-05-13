import type { AssistantStructuredResult } from "../../assistant/assistantResultTypes";
import type { ActionContext } from "./actionContext";

/** Declared action kinds — align with package manifests. */
export type DeclaredActionType =
  | "read_state"
  | "http"
  | "transaction_template"
  | "navigation"
  | "local_instruction";

export type PackagePermission =
  | "wallet:read"
  | "wallet:prepare_tx"
  | "contacts:read"
  | "transactions:read"
  | "network:fetch"
  | "navigation:write"
  | "storage:read"
  | "storage:write";

/** Manifest field kinds validated before invoking a handler (Zod may refine further in-package). */
export type ManifestFieldType = "string" | "optional_string" | "number" | "optional_number";

export type PackageActionManifestEntry = {
  name: string;
  description: string;
  type: DeclaredActionType;
  requiresConfirmation: boolean;
  /** Field name → validation kind. */
  inputSchema: Record<string, ManifestFieldType>;
  permissions?: PackagePermission[];
};

export type CorePackageManifest = {
  id: string;
  name: string;
  version: string;
  description?: string;
  permissions: PackagePermission[];
  actions: PackageActionManifestEntry[];
};

export type RuntimeActionDescriptor = {
  packageId: string;
  actionName: string;
  namespacedName: string;
  description: string;
  type: DeclaredActionType;
  requiresConfirmation: boolean;
  inputSchema: Record<string, ManifestFieldType>;
  requiredPermissions: PackagePermission[];
};

export type RuntimeActionExecutionRequest = {
  accountId: string;
  namespacedName: string;
  input: Record<string, unknown>;
};

export type PackageActionHandler = (
  input: Record<string, unknown>,
  ctx: ActionContext,
) => Promise<AssistantStructuredResult[]>;
