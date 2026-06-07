import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { getSuiClientForEnvironment } from "../../../main/services/chains/sui/sui-client.service";
import {
  appendAftermathSwapToTransaction,
  deserializeAftermathRoute,
} from "../../../main/services/chains/sui/sui-aftermath-swap.service";
import { buildNaviDepositIntoTransaction } from "../../core/yield/navi/navi-transaction-builder";
import type { NaviPoolRow } from "../../core/yield/navi/navi.types";
import type { SwapProposalSnapshotV1 } from "../../core/swap/swap.types";
import type { NaviYieldProposalSnapshotV1 } from "../../core/yield/navi/navi.types";
import {
  createTransactionBuildContext,
  getAlias,
  type TransactionBuildContext,
} from "../../../services/transactions/transactionContext";
import { deserializeExecutionPlan } from "./compositeExecutionPlan";
import type { CompositeProposalSnapshotV1 } from "./compositeTypes";
import { toAftermathSlippage } from "../../../shared/swap/slippage";

export async function buildCompositePtbBytes(snapshot: CompositeProposalSnapshotV1): Promise<Uint8Array> {
  const plan = deserializeExecutionPlan(snapshot.planJson);
  const ctx = createTransactionBuildContext({
    senderAddress: snapshot.walletAddress,
    suiEnvironment: snapshot.suiEnvironment,
  });

  console.info("[composite] building PTB", {
    planId: plan.planId,
    kind: plan.kind,
    steps: plan.steps.length,
  });

  for (const step of plan.steps) {
    if (step.type === "swap") {
      if (!snapshot.swapSnapshot) {
        throw new Error("[composite] Missing swap snapshot for PTB build.");
      }
      await appendSwapStep(ctx, snapshot.swapSnapshot, step.outputAlias ?? "swapOutput");
    } else if (step.type === "yield_deposit") {
      if (!snapshot.depositSnapshot) {
        throw new Error("[composite] Missing deposit snapshot for PTB build.");
      }
      await appendDepositStep(ctx, snapshot.depositSnapshot, step.inputFromAlias);
    } else {
      throw new Error(`[composite] Unsupported step type in PTB: ${step.type}`);
    }
  }

  const client = getSuiClientForEnvironment(snapshot.suiEnvironment);
  const bytes = await ctx.tx.build({ client });
  console.info("[ptb] built composite bytes", bytes.length);
  return bytes;
}

async function appendSwapStep(
  ctx: TransactionBuildContext,
  snap: SwapProposalSnapshotV1,
  outputAlias: string,
): Promise<void> {
  const route = deserializeAftermathRoute(snap.completeRouteJson);
  toAftermathSlippage(snap.slippageBps);
  console.info("[swap] quote in", snap.coinInAmountRaw, "est out", snap.estimatedOutRaw);
  await appendAftermathSwapToTransaction(ctx, {
    completeRoute: route,
    slippageBps: snap.slippageBps,
    outputAlias,
  });
}

async function appendDepositStep(
  ctx: TransactionBuildContext,
  depSnap: NaviYieldProposalSnapshotV1,
  inputFromAlias?: string,
): Promise<void> {
  const { fetchNaviPools, resolvePoolByAssetSymbol } = await import("../../core/yield/navi/navi-pools.service");
  const pools = await fetchNaviPools(ctx.suiEnvironment, true);
  const pool = await resolvePoolByAssetSymbol(pools, depSnap.assetSymbol);
  if (!pool) {
    throw new Error(`[navi] Pool not found for ${depSnap.assetSymbol}`);
  }

  const amountRaw = BigInt(depSnap.amountRaw);
  const inputCoin = inputFromAlias ? getAlias(ctx, inputFromAlias) : undefined;
  console.info("[navi] deposit", depSnap.amountDisplay, depSnap.assetSymbol, {
    piped: Boolean(inputCoin),
  });

  await buildNaviDepositIntoTransaction(ctx, {
    pool: pool as NaviPoolRow,
    amountRaw,
    inputCoin,
  });

  if (inputCoin) {
    ctx.tx.transferObjects([inputCoin], ctx.tx.pure.address(ctx.senderAddress));
    console.info("[tx-compose] swap remainder returned to sender");
  }
}
