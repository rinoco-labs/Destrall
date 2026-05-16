import type { CorePackageManifest } from "../../packages/runtime/actionTypes";
import { contactsPackageManifest } from "../../packages/core/contacts/contacts.manifest";
import { compositePackageManifest } from "../../packages/core/composite/composite.manifest";
import { portfolioPackageManifest } from "../../packages/core/portfolio/portfolio.manifest";
import { rebalancePackageManifest } from "../../packages/core/rebalance/rebalance.manifest";
import { swapAftermathPackageManifest } from "../../packages/core/swap/swap.manifest";
import { timePackageManifest } from "../../packages/core/time/time.manifest";
import { triggersPackageManifest } from "../../packages/core/triggers/triggers.manifest";
import { walletSendPackageManifest } from "../../packages/core/wallet/send.manifest";
import { naviYieldPackageManifest } from "../../packages/core/yield/navi/navi.manifest";

/** Manifests aligned with {@link registerCorePackages} — safe in main and renderer. */
const PACKAGE_MANIFESTS: CorePackageManifest[] = [
  walletSendPackageManifest,
  contactsPackageManifest,
  swapAftermathPackageManifest,
  naviYieldPackageManifest,
  compositePackageManifest,
  rebalancePackageManifest,
  portfolioPackageManifest,
  triggersPackageManifest,
  timePackageManifest,
];

const MANIFEST_BY_ID = new Map(PACKAGE_MANIFESTS.map((m) => [m.id, m]));

/** Resolve namespaced action ids from package manifests (no runtime registry required). */
export function packageActionsFromManifests(packageIds: string[]): string[] {
  return packageIds.flatMap((pid) => {
    const manifest = MANIFEST_BY_ID.get(pid);
    if (!manifest) return [];
    return manifest.actions.map((a) => `${manifest.id}.${a.name}`);
  });
}
