import { z } from "zod";

const nonEmptyTrimmed = z
  .string()
  .trim()
  .min(1, "Value is required");

export const prepareSwapInputSchema = z.object({
  fromToken: nonEmptyTrimmed,
  toToken: nonEmptyTrimmed,
  amount: nonEmptyTrimmed,
  slippageBps: z
    .number()
    .int()
    .min(1)
    .max(5_000)
    .optional(),
});

export const listSwappableTokensInputSchema = z.object({
  query: z.string().trim().optional(),
});

export const executeSwapInputSchema = z.object({
  proposalId: nonEmptyTrimmed,
});

export type PrepareSwapInput = z.infer<typeof prepareSwapInputSchema>;
export type ListSwappableTokensInput = z.infer<typeof listSwappableTokensInputSchema>;
export type ExecuteSwapInput = z.infer<typeof executeSwapInputSchema>;
