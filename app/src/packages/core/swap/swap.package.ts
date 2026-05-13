import { swapAftermathPackageManifest } from "./swap.manifest";
import { executeSwapAction, listSwappableTokensAction, prepareSwapAction } from "./swap.actions";
import { actionRegistry } from "@packages/runtime/actionRegistry";
import { registerActionHandler } from "@packages/runtime/actionExecutor";

const PKG = swapAftermathPackageManifest.id;

export function registerSwapAftermathPackage() {
  actionRegistry.registerManifest(swapAftermathPackageManifest);
  registerActionHandler(`${PKG}.list_swappable_tokens`, listSwappableTokensAction);
  registerActionHandler(`${PKG}.prepare_swap`, prepareSwapAction);
  registerActionHandler(`${PKG}.execute_swap`, executeSwapAction);
}
