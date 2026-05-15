import { timePackageManifest } from "./time.manifest";
import { getCurrentTimeAction } from "./time.actions";
import { actionRegistry } from "../../runtime/actionRegistry";
import { registerActionHandler } from "../../runtime/actionExecutor";

const PKG = timePackageManifest.id;

export function registerTimePackage() {
  actionRegistry.registerManifest(timePackageManifest);
  registerActionHandler(`${PKG}.get_current_time`, getCurrentTimeAction);
}
