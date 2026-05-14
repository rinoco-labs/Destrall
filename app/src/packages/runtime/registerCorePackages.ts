import { registerWalletSendPackage } from "../core/wallet/send.package";
import { registerContactsPackage } from "../core/contacts/contacts.package";
import { registerSwapAftermathPackage } from "../core/swap/swap.package";
import { registerNaviYieldPackage } from "../core/yield/navi/navi.package";
import { registerCompositePackage } from "../core/composite/composite.package";
import { registerRebalancePackage } from "../core/rebalance/rebalance.package";
import { registerPortfolioPackage } from "../core/portfolio/portfolio.package";

let registered = false;

/** Idempotent — safe to call on each main startup. */
export function registerCorePackages() {
  if (registered) return;
  registered = true;
  registerWalletSendPackage();
  registerContactsPackage();
  registerSwapAftermathPackage();
  registerNaviYieldPackage();
  registerCompositePackage();
  registerRebalancePackage();
  registerPortfolioPackage();
}
