import { registerWalletSendPackage } from "../core/wallet/send.package";
import { registerContactsPackage } from "../core/contacts/contacts.package";
import { registerSwapAftermathPackage } from "../core/swap/swap.package";
import { registerNaviYieldPackage } from "../core/yield/navi/navi.package";

let registered = false;

/** Idempotent — safe to call on each main startup. */
export function registerCorePackages() {
  if (registered) return;
  registered = true;
  registerWalletSendPackage();
  registerContactsPackage();
  registerSwapAftermathPackage();
  registerNaviYieldPackage();
}
