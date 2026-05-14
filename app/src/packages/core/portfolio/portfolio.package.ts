import { portfolioPackageManifest } from "./portfolio.manifest";
import { getPortfolioSummaryAction } from "./portfolio.actions";
import { actionRegistry } from "../../runtime/actionRegistry";
import { registerActionHandler } from "../../runtime/actionExecutor";

const NAMESPACED = `${portfolioPackageManifest.id}.get_summary`;

export function registerPortfolioPackage() {
  actionRegistry.registerManifest(portfolioPackageManifest);
  registerActionHandler(NAMESPACED, getPortfolioSummaryAction);
}
