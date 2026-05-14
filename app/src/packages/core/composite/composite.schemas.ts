import { z } from "zod";

export const prepareSwapThenDepositInputSchema = z.object({
  spendSymbol: z.string().min(1).max(32),
  poolAssetSymbol: z.string().min(1).max(32),
  amount: z.string().min(1).max(64),
  amountKind: z.enum(["percentage", "absolute"]),
});
