import { randomUUID } from "node:crypto";
import type { AssistantStructuredResult } from "../../../assistant/assistantResultTypes";
import type { ActionContext } from "../actionContext";
import { decimalStringToRawAmount } from "../../../main/services/chains/amount-utils";
import { formatTokenAmount } from "../../../main/services/chains/sui/sui-balance.service";
import { fetchNaviPools, resolvePoolByAssetSymbol } from "../../core/yield/navi/navi-pools.service";
import { prepareSwapAction } from "../../core/swap/swap.actions";
import { prepareYieldDepositAction } from "../../core/yield/navi/navi.actions";

export type SwapThenDepositParams = {
  spendSymbol: string;
  poolAssetSymbol: string;
  amount: string;
  amountKind: "percentage" | "absolute";
};

/**
 * Same-asset Navi deposit, or staged swap → deposit when the wallet holds a different spend asset.
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
  if (!head || head.type !== "swap_proposal") {
    return swapBlocks;
  }
  const snap = head.proposalSnapshot;
  if (!snap) {
    return swapBlocks;
  }

  const outDisp = formatTokenAmount(BigInt(snap.estimatedOutRaw), pool.decimals);
  const compositeId = randomUUID();
  return [
    {
      type: "composite_swap_then_deposit",
      compositeId,
      executionModel: "staged",
      swapProposal: head,
      depositPreview: {
        asset: pool.symbol,
        amountDisplay: `~${outDisp}`,
        poolLabel: `Navi ${pool.symbol}`,
        apyText: `${pool.supplyApy.toFixed(2)}% supply APY (live at prepare time)`,
      },
      riskNotes: [
        "Staged flow: approve the swap first. After it confirms, prepare the Navi deposit again so amounts match your wallet.",
        "Slippage can change received tokens; APY and pool parameters can move before deposit.",
        "Smart-contract and oracle risk apply to both swap and lend.",
      ],
    },
  ];
}
