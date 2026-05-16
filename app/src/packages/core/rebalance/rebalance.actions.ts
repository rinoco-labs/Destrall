import { randomUUID } from "node:crypto";
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
import { prepareRebalanceSwapLegs } from "./rebalancePtbBuilder";
import type { RebalanceProposalSnapshotV1 } from "./rebalance.types";

const REBALANCE_TTL_MS = 3 * 60 * 1000;

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
  if (net.environment === "devnet") {
    return [{ type: "error", message: "Rebalance is not available on Devnet.", code: "unsupported_network" }];
  }

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
    const totalUsd = current.reduce((a, c) => a + c.valueUsd, 0);
    const detail =
      dustSkipped.length > 0
        ? dustSkipped.slice(0, 4).join(" ")
        : totalUsd < 1
          ? "Portfolio value is too small to rebalance with current thresholds."
          : "Remaining gaps are below the minimum trade size for this portfolio.";
    return [
      {
        type: "error",
        message: `No rebalance swaps could be built. ${detail}`,
        code: "no_swaps",
      },
    ];
  }

  console.info("[rebalance] planned swaps", swaps.length);
  const legResult = await prepareRebalanceSwapLegs(ctx, swaps);
  if (!Array.isArray(legResult) || legResult.length === 0) {
    return [{ type: "error", message: "No swap legs prepared.", code: "no_swaps" }];
  }
  if ("type" in legResult[0]) {
    return legResult as AssistantStructuredResult[];
  }

  const swapLegs = legResult as import("./rebalancePtbBuilder").RebalanceSwapLegSnapshot[];
  const proposalId = randomUUID();
  const now = Date.now();
  const proposalSnapshot: RebalanceProposalSnapshotV1 = {
    v: 1,
    proposalId,
    accountId: ctx.accountId,
    suiEnvironment: net.environment,
    walletAddress: account.address,
    swapLegs,
    preparedAtMs: now,
    expiresAtMs: now + REBALANCE_TTL_MS,
  };

  const proposal = buildRebalanceProposal({
    network: net.displayName,
    current,
    target: normalizedTargets,
    swaps,
    dustSkipped,
  });

  return [
    {
      ...proposal,
      proposalId,
      status: "pending",
      proposalSnapshot,
      executable: true,
    },
  ];
}
