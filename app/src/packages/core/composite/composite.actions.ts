import type { AssistantStructuredResult } from "../../../assistant/assistantResultTypes";
import type { ActionContext } from "../../runtime/actionContext";
import { buildSwapThenDepositPlan } from "../../runtime/composite/compositeProposalBuilder";
import { prepareSwapThenDepositInputSchema } from "./composite.schemas";

export async function prepareSwapThenDepositAction(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  const parsed = prepareSwapThenDepositInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid composite request.";
    return [{ type: "error", message: first, code: "invalid_input" }];
  }
  return buildSwapThenDepositPlan(ctx, {
    spendSymbol: parsed.data.spendSymbol,
    poolAssetSymbol: parsed.data.poolAssetSymbol,
    amount: parsed.data.amount,
    amountKind: parsed.data.amountKind,
  });
}
