import { walletSendPackageManifest } from "./send.manifest";
import { prepareSendAction } from "./send.actions";
import { actionRegistry } from "@packages/runtime/actionRegistry";
import { registerActionHandler } from "@packages/runtime/actionExecutor";

const NAMESPACED = `${walletSendPackageManifest.id}.prepare_send`;

export function registerWalletSendPackage() {
  actionRegistry.registerManifest(walletSendPackageManifest);
  registerActionHandler(NAMESPACED, prepareSendAction);
}
