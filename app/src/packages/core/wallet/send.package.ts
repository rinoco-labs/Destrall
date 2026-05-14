import { walletSendPackageManifest } from "./send.manifest";
import { getWalletAddressAction, prepareSendAction } from "./send.actions";
import { actionRegistry } from "@packages/runtime/actionRegistry";
import { registerActionHandler } from "@packages/runtime/actionExecutor";

const PREPARE_SEND = `${walletSendPackageManifest.id}.prepare_send`;
const GET_ADDRESS = `${walletSendPackageManifest.id}.get_wallet_address`;

export function registerWalletSendPackage() {
  actionRegistry.registerManifest(walletSendPackageManifest);
  registerActionHandler(PREPARE_SEND, prepareSendAction);
  registerActionHandler(GET_ADDRESS, getWalletAddressAction);
}
