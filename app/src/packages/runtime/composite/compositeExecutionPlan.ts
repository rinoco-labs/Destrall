import { randomUUID } from "node:crypto";
import type { CompositeExecutionPlan, CompositeExecutionStep } from "./compositeTypes";

export function serializeExecutionPlan(plan: CompositeExecutionPlan): string {
  return JSON.stringify(plan);
}

export function deserializeExecutionPlan(json: string): CompositeExecutionPlan {
  const parsed = JSON.parse(json) as CompositeExecutionPlan;
  if (!parsed?.planId || !Array.isArray(parsed.steps)) {
    throw new Error("Invalid composite execution plan.");
  }
  return parsed;
}

export function createSwapThenDepositPlan(params: {
  spendSymbol: string;
  poolSymbol: string;
  swapAmountDisplay: string;
  depositAmountDisplay: string;
  poolLabel: string;
  apyText?: string;
  singlePtb: boolean;
}): CompositeExecutionPlan {
  const swapAlias = "swapOutput";
  const steps: CompositeExecutionStep[] = [
    {
      id: randomUUID(),
      type: "swap",
      package: "core.swap.aftermath",
      label: `Swap ${params.swapAmountDisplay} ${params.spendSymbol} → ${params.poolSymbol}`,
      outputAlias: swapAlias,
      preview: {
        fromSymbol: params.spendSymbol,
        toSymbol: params.poolSymbol,
        amountDisplay: params.swapAmountDisplay,
      },
    },
    {
      id: randomUUID(),
      type: "yield_deposit",
      package: "core.yield.navi",
      label: `Deposit ${params.depositAmountDisplay} ${params.poolSymbol} into ${params.poolLabel}`,
      inputFromAlias: swapAlias,
      preview: {
        asset: params.poolSymbol,
        amountDisplay: params.depositAmountDisplay,
        poolLabel: params.poolLabel,
        apyText: params.apyText,
      },
    },
  ];
  return {
    planId: randomUUID(),
    kind: "swap_then_deposit",
    steps,
    singlePtb: params.singlePtb,
  };
}
