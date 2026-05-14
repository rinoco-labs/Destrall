import { compositePackageManifest } from "./composite.manifest";
import { prepareSwapThenDepositAction } from "./composite.actions";
import { actionRegistry } from "../../runtime/actionRegistry";
import { registerActionHandler } from "../../runtime/actionExecutor";

const NAMESPACED = `${compositePackageManifest.id}.swap_then_deposit`;

export function registerCompositePackage() {
  actionRegistry.registerManifest(compositePackageManifest);
  registerActionHandler(NAMESPACED, prepareSwapThenDepositAction);
}
