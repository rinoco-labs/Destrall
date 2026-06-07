import { z } from "zod";

const suiEnvSchema = z.enum(["mainnet", "testnet", "devnet"]);

export const swapProposalSnapshotV1Schema = z.object({
  v: z.literal(1),
  accountId: z.string().min(1).max(128),
  suiEnvironment: suiEnvSchema,
  walletAddress: z.string().min(1).max(256),
  fromCoinType: z.string().min(1).max(512),
  toCoinType: z.string().min(1).max(512),
  fromSymbol: z.string().min(1).max(64),
  toSymbol: z.string().min(1).max(64),
  amountDisplay: z.string().min(1).max(64),
  coinInAmountRaw: z.string().regex(/^\d+$/),
  estimatedOutRaw: z.string().regex(/^\d+$/),
  slippageBps: z.number().int().min(10).max(500),
  appFeeBps: z.number().int().min(0).max(10_000),
  treasuryAddress: z.string().min(1).max(256).optional(),
  quoteExpiresAtMs: z.number().int(),
  completeRouteJson: z.string().min(1).max(4_000_000),
});

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
    .min(10, "Slippage must be at least 10 bps (0.1%).")
    .max(500, "Slippage cannot exceed 500 bps (5%).")
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
