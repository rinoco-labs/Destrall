import type { AssistantStructuredResult } from "../../../assistant/assistantResultTypes";
import type { ActionContext } from "../../runtime/actionContext";
import {
  buildRebalanceProposal,
  calculateCurrentAllocation,
  calculateSwapDeltas,
  normalizeTargets,
  parseRebalanceTargets,
} from "./rebalancePlanner";
import { prepareRebalanceInputSchema } from "./rebalance.schemas";

export async function prepareRebalanceAction(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  const parsed = prepareRebalanceInputSchema.safeParse(input);
  if (!parsed.success) {
    return [{ type: "error", message: "Invalid rebalance request.", code: "invalid_input" }];
  }
  const account = ctx.wallet.getActiveAccount();
  if (!account || account.chain !== "sui") {
    return [{ type: "error", message: "Switch to a Sui account for rebalancing.", code: "unsupported_chain" }];
  }
  const net = ctx.network.getActiveNetwork();

  const rawTargets = parseRebalanceTargets(parsed.data.distributionText);
  if (!rawTargets) {
    return [
      {
        type: "error",
        message: "Could not read target percentages. Example: 30% SUI, 20% USDC, and the rest in WAL.",
        code: "invalid_targets",
      },
    ];
  }
  const norm = normalizeTargets(rawTargets);
  if (norm.ok === false) {
    return [{ type: "error", message: norm.error, code: "invalid_targets" }];
  }
  const normalizedTargets = norm.targets;

  const balances = await ctx.wallet.getBalances();
  const current = calculateCurrentAllocation(balances);
  if (current.length === 0) {
    return [
      {
        type: "error",
        message: "Need USD-priced balances to compute a rebalance. Wait for prices to load or try again.",
        code: "missing_prices",
      },
    ];
  }

  const { swaps, dustSkipped } = calculateSwapDeltas(current, normalizedTargets, balances);
  if (swaps.length === 0) {
    return [
      {
        type: "error",
        message: "No swaps needed — you may already match this target, or surpluses are below the dust threshold.",
        code: "no_swaps",
      },
    ];
  }

  return [
    buildRebalanceProposal({
      network: net.displayName,
      current,
      target: normalizedTargets,
      swaps,
      dustSkipped,
    }),
  ];
}
