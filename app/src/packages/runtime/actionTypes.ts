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

export type PackageActionManifestEntry = {
  name: string;
  description: string;
  type: DeclaredActionType;
  requiresConfirmation: boolean;
  /** Loose schema map for validation (field name → primitive type name). */
  inputSchema: Record<string, string>;
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
  inputSchema: Record<string, string>;
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
