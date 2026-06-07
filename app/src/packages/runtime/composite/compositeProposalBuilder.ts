import { randomUUID } from "node:crypto";
import type { AssistantStructuredResult } from "../../../assistant/assistantResultTypes";
import type { ActionContext } from "../actionContext";
import { formatTokenAmount, parseTokenAmount } from "../../../shared/tokens/amounts";
import { fetchNaviPools } from "../../core/yield/navi/navi-pools.service";
import { resolveNaviPoolByAsset } from "../../../services/tokens/naviTokenResolver";
import { resolveWalletToken } from "../../../services/tokens/walletTokenResolver";
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
  const poolResult = resolveNaviPoolByAsset(pools, params.poolAssetSymbol);
  if (poolResult.kind === "not_found") {
    return [{ type: "error", message: poolResult.message, code: "unknown_pool" }];
  }
  if (poolResult.kind === "ambiguous") {
    return [
      {
        type: "error",
        message: `Multiple Navi pools match "${params.poolAssetSymbol}": ${poolResult.candidates.map((c) => c.symbol).join(", ")}.`,
        code: "ambiguous_pool",
      },
    ];
  }
  const pool = poolResult.pool;

  console.info("[composite] swap_then_deposit", {
    spend: params.spendSymbol,
    pool: pool.symbol,
    amount: params.amount,
  });

  const balances = await ctx.wallet.getBalances();
  const spendPick = resolveWalletToken(params.spendSymbol, balances, {
    requirePositiveBalance: true,
    walletAddress: account.address,
    logContext: "composite_spend",
  });
  if (spendPick.kind === "not_found") {
    return [{ type: "error", message: spendPick.message, code: "insufficient_funds" }];
  }
  if (spendPick.kind === "ambiguous") {
    return [
      {
        type: "error",
        message: `Multiple tokens match "${params.spendSymbol}" in your wallet: ${spendPick.candidates.map((c) => c.symbol).join(", ")}.`,
        code: "ambiguous_token",
      },
    ];
  }
  const spendBal = spendPick.balance;
  const poolSym = pool.symbol.toUpperCase();
  const spendSym = spendBal.symbol.toUpperCase();

  if (spendSym === poolSym || spendBal.coinType === pool.coinType) {
    return prepareYieldDepositAction(
      {
        asset: pool.symbol,
        amount: params.amount,
        amountKind: params.amountKind,
      },
      ctx,
    );
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
    const raw = parseTokenAmount(params.amount.trim(), spendBal.decimals, spendBal.symbol);
    if (raw <= 0n) {
      return [{ type: "error", message: "Invalid swap amount.", code: "invalid_amount" }];
    }
    if (raw > BigInt(spendBal.balanceRaw)) {
      return [
        {
          type: "error",
          message: `Not enough ${spendBal.symbol} for that swap.`,
          code: "insufficient_funds",
        },
      ];
    }
  }

  const swapBlocks = await prepareSwapAction(
    {
      fromToken: spendBal.symbol,
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
    spendSymbol: spendBal.symbol,
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
