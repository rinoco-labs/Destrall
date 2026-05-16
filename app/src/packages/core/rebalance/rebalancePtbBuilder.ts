import { randomUUID } from "node:crypto";
import type { AssistantStructuredResult } from "../../../assistant/assistantResultTypes";
import type { SwapProposalSnapshotV1 } from "../swap/swap.types";
import type { SwapDeltaLeg } from "./rebalancePlanner";
import type { ActionContext } from "../../runtime/actionContext";
import { prepareSwapAction } from "../swap/swap.actions";
import { createTransactionBuildContext } from "../../../services/transactions/transactionContext";
import {
  appendAftermathSwapToTransaction,
  deserializeAftermathRoute,
} from "../../../main/services/chains/sui/sui-aftermath-swap.service";
import { getSuiClientForEnvironment } from "../../../main/services/chains/sui/sui-client.service";
import type { SuiChainEnvironment } from "../../../config/chains/sui";

export type RebalanceSwapLegSnapshot = {
  legId: string;
  fromSymbol: string;
  toSymbol: string;
  amountDisplay: string;
  swapSnapshot: SwapProposalSnapshotV1;
};

export async function buildRebalancePtbBytes(
  legs: RebalanceSwapLegSnapshot[],
  walletAddress: string,
  env: SuiChainEnvironment,
): Promise<Uint8Array> {
  const ctx = createTransactionBuildContext({ senderAddress: walletAddress, suiEnvironment: env });
  console.info("[rebalance] PTB legs", legs.length);

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const alias = `rebalanceSwap${i}`;
    const route = deserializeAftermathRoute(leg.swapSnapshot.completeRouteJson);
    await appendAftermathSwapToTransaction(ctx, {
      completeRoute: route,
      slippageBps: leg.swapSnapshot.slippageBps,
      outputAlias: alias,
    });
    const coin = ctx.aliases.get(alias);
    if (coin) {
      ctx.tx.transferObjects([coin], ctx.tx.pure.address(walletAddress));
    }
  }

  const client = getSuiClientForEnvironment(env);
  return ctx.tx.build({ client });
}

export async function prepareRebalanceSwapLegs(
  ctx: ActionContext,
  swaps: SwapDeltaLeg[],
): Promise<RebalanceSwapLegSnapshot[] | AssistantStructuredResult[]> {
  const legs: RebalanceSwapLegSnapshot[] = [];
  for (const swap of swaps) {
    console.info("[rebalance] preparing leg", swap.fromSymbol, "→", swap.toSymbol, swap.amountDisplay);
    const blocks = await prepareSwapAction(
      {
        fromToken: swap.fromSymbol,
        toToken: swap.toSymbol,
        amount: swap.amountDisplay,
      },
      ctx,
    );
    const head = blocks[0];
    if (!head || head.type !== "swap_proposal" || !head.proposalSnapshot) {
      return blocks;
    }
    legs.push({
      legId: randomUUID(),
      fromSymbol: swap.fromSymbol,
      toSymbol: swap.toSymbol,
      amountDisplay: swap.amountDisplay,
      swapSnapshot: head.proposalSnapshot,
    });
  }
  return legs;
}
