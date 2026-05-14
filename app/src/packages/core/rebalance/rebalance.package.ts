import { rebalancePackageManifest } from "./rebalance.manifest";
import { prepareRebalanceAction } from "./rebalance.actions";
import { actionRegistry } from "../../runtime/actionRegistry";
import { registerActionHandler } from "../../runtime/actionExecutor";

const NAMESPACED = `${rebalancePackageManifest.id}.prepare_rebalance`;

export function registerRebalancePackage() {
  actionRegistry.registerManifest(rebalancePackageManifest);
  registerActionHandler(NAMESPACED, prepareRebalanceAction);
}
