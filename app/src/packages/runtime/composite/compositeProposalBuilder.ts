import { randomUUID } from "node:crypto";
import type { AssistantStructuredResult } from "../../../assistant/assistantResultTypes";
import type { ActionContext } from "../actionContext";
import { decimalStringToRawAmount } from "../../../main/services/chains/amount-utils";
import { formatTokenAmount } from "../../../main/services/chains/sui/sui-balance.service";
import { fetchNaviPools, resolvePoolByAssetSymbol } from "../../core/yield/navi/navi-pools.service";
import { prepareSwapAction } from "../../core/swap/swap.actions";
import { prepareYieldDepositAction } from "../../core/yield/navi/navi.actions";
import type { CompositeProposalSnapshotV1, CompositeStepPreview } from "./compositeTypes";
import { createSwapThenDepositPlan, serializeExecutionPlan } from "./compositeExecutionPlan";
import { buildCompositeProposalCard } from "./compositeActionPlanner";

const COMPOSITE_TTL_MS = 3 * 60 * 1000;

export type SwapThenDepositParams = {
  spendSymbol: string;
  poolAssetSymbol: string;
  amount: string;
  amountKind: "percentage" | "absolute";
};

/**
 * Swap → Navi deposit as a single PTB when assets differ; direct deposit when same asset.
 */
export async function buildSwapThenDepositPlan(
  ctx: ActionContext,
  params: SwapThenDepositParams,
): Promise<AssistantStructuredResult[]> {
  const account = ctx.wallet.getActiveAccount();
  if (!account || account.chain !== "sui") {
    return [{ type: "error", message: "Switch to a Sui account.", code: "unsupported_chain" }];
  }
  const net = ctx.network.getActiveNetwork();
  if (net.environment === "devnet") {
    return [{ type: "error", message: "Composite yield flows require mainnet or testnet.", code: "unsupported_network" }];
  }

  const pools = await fetchNaviPools(net.environment, false);
  const pool = await resolvePoolByAssetSymbol(pools, params.poolAssetSymbol);
  if (!pool) {
    return [
      {
        type: "error",
        message: `Could not find a Navi pool for "${params.poolAssetSymbol}".`,
        code: "unknown_pool",
      },
    ];
  }

  const spend = params.spendSymbol.trim().toUpperCase();
  const poolSym = pool.symbol.toUpperCase();

  console.info("[composite] swap_then_deposit", { spend, pool: poolSym, amount: params.amount });

  if (spend === poolSym) {
    return prepareYieldDepositAction(
      {
        asset: pool.symbol,
        amount: params.amount,
        amountKind: params.amountKind,
      },
      ctx,
    );
  }

  const balances = await ctx.wallet.getBalances();
  const spendBal = balances.find((b) => b.symbol.toUpperCase() === spend);
  if (!spendBal) {
    return [{ type: "error", message: `No ${spend} balance in this wallet.`, code: "insufficient_funds" }];
  }

  let swapAmountDisplay = params.amount.trim();
  if (params.amountKind === "percentage") {
    const pct = parseFloat(params.amount.replace(/%/g, ""));
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      return [{ type: "error", message: "Percentage must be between 0 and 100.", code: "invalid_amount" }];
    }
    const walletRaw = BigInt(spendBal.balanceRaw);
    const amountRaw = (walletRaw * BigInt(Math.round(pct * 100))) / 10000n;
    if (amountRaw <= 0n) {
      return [{ type: "error", message: "Computed swap amount is zero.", code: "invalid_amount" }];
    }
    swapAmountDisplay = formatTokenAmount(amountRaw, spendBal.decimals);
  } else {
    const raw = decimalStringToRawAmount(params.amount.trim(), spendBal.decimals);
    if (raw <= 0n) {
      return [{ type: "error", message: "Invalid swap amount.", code: "invalid_amount" }];
    }
    if (raw > BigInt(spendBal.balanceRaw)) {
      return [{ type: "error", message: `Not enough ${spend} for that swap.`, code: "insufficient_funds" }];
    }
  }

  const swapBlocks = await prepareSwapAction(
    {
      fromToken: spend,
      toToken: pool.symbol,
      amount: swapAmountDisplay,
    },
    ctx,
  );
  const head = swapBlocks[0];
  if (!head || head.type !== "swap_proposal" || !head.proposalSnapshot) {
    return swapBlocks;
  }

  const snap = head.proposalSnapshot;
  const outDisp = formatTokenAmount(BigInt(snap.estimatedOutRaw), pool.decimals);
  const depositAmountRaw = BigInt(snap.estimatedOutRaw);
  const depositAmountDisplay = outDisp;

  const plan = createSwapThenDepositPlan({
    spendSymbol: spend,
    poolSymbol: pool.symbol,
    swapAmountDisplay,
    depositAmountDisplay: `~${depositAmountDisplay}`,
    poolLabel: `Navi ${pool.symbol}`,
    apyText: `${pool.supplyApy.toFixed(2)}% supply APY`,
    singlePtb: net.environment === "mainnet",
  });

  const now = Date.now();
  const compositeId = randomUUID();
  const proposalId = randomUUID();

  const depositSnap = {
    v: 1 as const,
    kind: "deposit" as const,
    accountId: ctx.accountId,
    suiEnvironment: net.environment,
    walletAddress: account.address,
    assetSymbol: pool.symbol,
    coinType: pool.coinType,
    decimals: pool.decimals,
    assetId: pool.assetId,
    poolObjectId: pool.poolObjectId,
    reserveId: pool.reserveId,
    amountRaw: depositAmountRaw.toString(),
    amountDisplay: depositAmountDisplay,
    feeAmountRaw: "0",
    supplyApyAtPrepare: pool.supplyApy,
    preparedAtMs: now,
    expiresAtMs: now + COMPOSITE_TTL_MS,
  };

  const proposalSnapshot: CompositeProposalSnapshotV1 = {
    v: 1,
    compositeId,
    planId: plan.planId,
    accountId: ctx.accountId,
    suiEnvironment: net.environment,
    walletAddress: account.address,
    executionModel: plan.singlePtb ? "ptb" : "staged",
    planJson: serializeExecutionPlan(plan),
    preparedAtMs: now,
    expiresAtMs: now + COMPOSITE_TTL_MS,
    swapSnapshot: snap,
    depositSnapshot: depositSnap,
    slippageBps: snap.slippageBps,
  };

  const steps: CompositeStepPreview[] = plan.steps.map((s, i) => ({
    index: i + 1,
    label: s.label,
    detail: s.preview?.apyText,
  }));

  const card = buildCompositeProposalCard({
    title: plan.singlePtb ? "Swap + deposit (one transaction)" : "Swap + deposit (staged)",
    steps,
    networkLabel: net.displayName,
    executionModel: proposalSnapshot.executionModel,
    estimatedDeposit: `${depositAmountDisplay} ${pool.symbol}`,
    apyText: `${pool.supplyApy.toFixed(2)}% supply APY`,
  });

  const riskNotes = plan.singlePtb
    ? [
        "Single programmable transaction: swap output feeds the Navi deposit without a wallet refresh.",
        "Slippage can change received tokens; re-approve if the quote expires.",
        "Smart-contract and oracle risk apply to both swap and lend.",
      ]
    : [
        "Staged flow: only the swap runs first. Prepare deposit again after the swap confirms.",
        "Slippage can change received tokens; APY and pool parameters can move before deposit.",
      ];

  return [
    {
      type: "composite_swap_then_deposit",
      compositeId,
      proposalId,
      status: "pending",
      executionModel: proposalSnapshot.executionModel,
      steps,
      proposalSnapshot,
      depositPreview: {
        asset: pool.symbol,
        amountDisplay: `~${outDisp}`,
        poolLabel: `Navi ${pool.symbol}`,
        apyText: `${pool.supplyApy.toFixed(2)}% supply APY (live at prepare time)`,
      },
      swapProposal: head,
      card,
      riskNotes,
    },
  ];
}
