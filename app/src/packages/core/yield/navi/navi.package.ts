import { naviYieldPackageManifest } from "./navi.manifest";
import {
  executeYieldActionAction,
  getYieldPositionsAction,
  listYieldPoolsAction,
  prepareYieldDepositAction,
  prepareYieldWithdrawAction,
} from "./navi.actions";
import { actionRegistry } from "@packages/runtime/actionRegistry";
import { registerActionHandler } from "@packages/runtime/actionExecutor";

const PKG = naviYieldPackageManifest.id;

export function registerNaviYieldPackage() {
  actionRegistry.registerManifest(naviYieldPackageManifest);
  registerActionHandler(`${PKG}.list_yield_pools`, listYieldPoolsAction);
  registerActionHandler(`${PKG}.get_yield_positions`, getYieldPositionsAction);
  registerActionHandler(`${PKG}.prepare_yield_deposit`, prepareYieldDepositAction);
  registerActionHandler(`${PKG}.prepare_yield_withdraw`, prepareYieldWithdrawAction);
  registerActionHandler(`${PKG}.execute_yield_action`, executeYieldActionAction);
}
