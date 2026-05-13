import type { CorePackageManifest, PackageActionManifestEntry, PackagePermission } from "./actionTypes";

export function getRequiredPermissionsForAction(
  manifest: CorePackageManifest,
  actionName: string,
): PackagePermission[] {
  const action = manifest.actions.find((a) => a.name === actionName);
  return action?.permissions?.length ? action.permissions : manifest.permissions;
}

export function validateManifestPermissions(manifest: CorePackageManifest): string[] {
  const errors: string[] = [];
  const forbidden = new Set([
    "wallet:private_key",
    "wallet:seed_phrase",
    "wallet:raw_signer",
    "wallet:sign_without_confirmation",
  ]);
  for (const p of manifest.permissions) {
    if (forbidden.has(p)) {
      errors.push(`Forbidden permission on package ${manifest.id}: ${p}`);
    }
  }
  for (const a of manifest.actions) {
    for (const p of a.permissions ?? []) {
      if (forbidden.has(p)) {
        errors.push(`Forbidden permission on action ${manifest.id}.${a.name}: ${p}`);
      }
    }
  }
  return errors;
}

export function actionSupportsPermissions(
  required: PackagePermission[],
  granted: PackagePermission[],
): boolean {
  const g = new Set(granted);
  return required.every((p) => g.has(p));
}

/** Map action type to minimum implied permissions (defense in depth). */
export function impliedPermissionsForAction(action: PackageActionManifestEntry): PackagePermission[] {
  if (action.type === "transaction_template") {
    return ["wallet:prepare_tx"];
  }
  if (action.type === "read_state") {
    return [];
  }
  return [];
}
