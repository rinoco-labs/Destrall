import type { CorePackageManifest, RuntimeActionDescriptor } from "./actionTypes";
import { getRequiredPermissionsForAction } from "./actionPermissions";

function parseNamespacedName(namespaced: string): { packageId: string; actionName: string } | null {
  const idx = namespaced.lastIndexOf(".");
  if (idx <= 0) return null;
  return { packageId: namespaced.slice(0, idx), actionName: namespaced.slice(idx + 1) };
}

export class ActionRegistry {
  private readonly actions = new Map<string, RuntimeActionDescriptor>();
  private readonly byNamespaced = new Map<string, RuntimeActionDescriptor>();

  clear() {
    this.actions.clear();
    this.byNamespaced.clear();
  }

  registerManifest(manifest: CorePackageManifest) {
    for (const action of manifest.actions) {
      const namespacedName = `${manifest.id}.${action.name}`;
      const key = `${manifest.id}:${action.name}`;
      const descriptor: RuntimeActionDescriptor = {
        packageId: manifest.id,
        actionName: action.name,
        namespacedName,
        description: action.description,
        type: action.type,
        requiresConfirmation: action.requiresConfirmation,
        inputSchema: action.inputSchema,
        requiredPermissions: getRequiredPermissionsForAction(manifest, action.name),
      };
      this.actions.set(key, descriptor);
      this.byNamespaced.set(namespacedName, descriptor);
    }
  }

  listForAssistant(): RuntimeActionDescriptor[] {
    return [...this.actions.values()];
  }

  get(packageId: string, actionName: string) {
    return this.actions.get(`${packageId}:${actionName}`);
  }

  getByNamespacedName(namespacedName: string) {
    return this.byNamespaced.get(namespacedName);
  }

  parseNamespaced(namespacedName: string) {
    return parseNamespacedName(namespacedName);
  }
}

export const actionRegistry = new ActionRegistry();
