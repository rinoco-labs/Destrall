import type { AssistantStructuredResult } from "../../assistant/assistantResultTypes";
import { actionRegistry } from "./actionRegistry";
import { createActionContext } from "./actionContext";
import type {
  CorePackageManifest,
  ManifestFieldType,
  PackageActionHandler,
  PackagePermission,
  RuntimeActionExecutionRequest,
} from "./actionTypes";
import { actionSupportsPermissions, validateManifestPermissions } from "./actionPermissions";
import { walletSendPackageManifest } from "../core/wallet/send.manifest";
import { contactsPackageManifest } from "../core/contacts/contacts.manifest";
import { swapAftermathPackageManifest } from "../core/swap/swap.manifest";
import { naviYieldPackageManifest } from "../core/yield/navi/navi.manifest";
import { compositePackageManifest } from "../core/composite/composite.manifest";
import { rebalancePackageManifest } from "../core/rebalance/rebalance.manifest";
import { portfolioPackageManifest } from "../core/portfolio/portfolio.manifest";

const handlers = new Map<string, PackageActionHandler>();

const CORE_MANIFESTS: Record<string, CorePackageManifest> = {
  [walletSendPackageManifest.id]: walletSendPackageManifest,
  [contactsPackageManifest.id]: contactsPackageManifest,
  [swapAftermathPackageManifest.id]: swapAftermathPackageManifest,
  [naviYieldPackageManifest.id]: naviYieldPackageManifest,
  [compositePackageManifest.id]: compositePackageManifest,
  [rebalancePackageManifest.id]: rebalancePackageManifest,
  [portfolioPackageManifest.id]: portfolioPackageManifest,
};

/** Core packages grant their declared permissions in full (installer UX can narrow later). */
const coreGrantedByPackage = new Map<string, Set<PackagePermission>>(
  Object.values(CORE_MANIFESTS).map((m) => [m.id, new Set<PackagePermission>(m.permissions)]),
);

export function registerActionHandler(namespacedName: string, handler: PackageActionHandler) {
  handlers.set(namespacedName, handler);
}

function validateInputSchema(input: Record<string, unknown>, schema: Record<string, ManifestFieldType>) {
  for (const [key, typ] of Object.entries(schema)) {
    if (typ === "string") {
      if (!(key in input) || typeof input[key] !== "string") {
        throw new Error(`Missing or invalid field: ${key}`);
      }
      continue;
    }
    if (typ === "optional_string") {
      if (!(key in input) || input[key] === undefined || input[key] === null) continue;
      if (typeof input[key] !== "string") {
        throw new Error(`Invalid field: ${key}`);
      }
      continue;
    }
    if (typ === "number") {
      if (!(key in input) || typeof input[key] !== "number" || !Number.isFinite(input[key])) {
        throw new Error(`Missing or invalid field: ${key}`);
      }
      continue;
    }
    if (typ === "optional_number") {
      if (!(key in input) || input[key] === undefined || input[key] === null) continue;
      if (typeof input[key] !== "number" || !Number.isFinite(input[key])) {
        throw new Error(`Invalid field: ${key}`);
      }
    }
  }
}

/**
 * Runs a registered package action with permission + schema checks.
 * Execution never signs transactions; transaction_template actions only prepare proposals.
 */
export async function executePackageAction(
  request: RuntimeActionExecutionRequest,
): Promise<AssistantStructuredResult[]> {
  const descriptor = actionRegistry.getByNamespacedName(request.namespacedName);
  if (!descriptor) {
    throw new Error(`Unknown action: ${request.namespacedName}`);
  }

  const manifest = CORE_MANIFESTS[descriptor.packageId];
  if (!manifest) {
    throw new Error(`Unknown package: ${descriptor.packageId}`);
  }
  const manifestErrors = validateManifestPermissions(manifest);
  if (manifestErrors.length) {
    throw new Error(manifestErrors[0]);
  }

  validateInputSchema(request.input, descriptor.inputSchema);

  const granted = coreGrantedByPackage.get(descriptor.packageId);
  if (!granted) {
    throw new Error(`Package not installed: ${descriptor.packageId}`);
  }
  if (!actionSupportsPermissions(descriptor.requiredPermissions, [...granted])) {
    throw new Error(`Action ${request.namespacedName} is missing required permissions.`);
  }

  if (descriptor.type === "transaction_template" && !descriptor.requiresConfirmation) {
    throw new Error("Transaction proposals must require confirmation.");
  }

  const handler = handlers.get(request.namespacedName);
  if (!handler) {
    throw new Error(`No handler registered for ${request.namespacedName}`);
  }

  const ctx = createActionContext(request.accountId);
  return handler(request.input, ctx);
}

export type { RuntimeActionExecutionRequest };
