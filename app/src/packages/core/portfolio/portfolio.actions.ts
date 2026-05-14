import type { AssistantStructuredResult } from "../../../assistant/assistantResultTypes";
import type { ActionContext } from "../../runtime/actionContext";
import { portfolioFromBalances } from "../../../assistant/portfolioCardBuilder";

export async function getPortfolioSummaryAction(
  _input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  const account = ctx.wallet.getActiveAccount();
  if (!account || account.chain !== "sui") {
    return [{ type: "error", message: "Switch to a Sui account to view a portfolio summary.", code: "unsupported_chain" }];
  }
  const net = ctx.network.getActiveNetwork();
  const balances = await ctx.wallet.getBalances();
  return [portfolioFromBalances(net.environment, balances)];
}
