import { z } from "zod";

const suiEnvSchema = z.enum(["mainnet", "testnet", "devnet"]);

export const listYieldPoolsInputSchema = z.object({
  asset: z.string().max(32).optional(),
  sortBy: z.enum(["apy", "tvl", "risk"]).optional(),
  riskProfile: z.enum(["conservative", "balanced", "aggressive", "max_yield"]).optional(),
});

export const getYieldPositionsInputSchema = z.object({
  asset: z.string().max(32).optional(),
});

export const prepareYieldDepositInputSchema = z.object({
  asset: z.string().min(1).max(32),
  amount: z.string().min(1).max(64),
  amountKind: z.enum(["absolute", "percentage"]).optional(),
});

export const prepareYieldWithdrawInputSchema = z.object({
  asset: z.string().min(1).max(32),
  amount: z.string().max(64).optional(),
  amountKind: z.enum(["absolute", "percentage", "all", "interest"]).optional(),
});

export const executeYieldActionInputSchema = z.object({
  proposalId: z.string().min(1).max(128),
});

export const naviYieldProposalSnapshotV1Schema = z.object({
  v: z.literal(1),
  kind: z.enum(["deposit", "withdraw"]),
  accountId: z.string().min(1).max(128),
  suiEnvironment: suiEnvSchema,
  walletAddress: z.string().min(1).max(256),
  assetSymbol: z.string().min(1).max(64),
  coinType: z.string().min(1).max(512),
  decimals: z.number().int().min(0).max(18),
  assetId: z.number().int().min(0).max(255),
  poolObjectId: z.string().min(1).max(256),
  reserveId: z.string().min(1).max(256),
  amountRaw: z.string().regex(/^\d+$/),
  amountDisplay: z.string().min(1).max(64),
  feeAmountRaw: z.string().regex(/^\d+$/),
  treasuryAddress: z.string().min(1).max(256).optional(),
  supplyApyAtPrepare: z.number(),
  preparedAtMs: z.number().int(),
  expiresAtMs: z.number().int(),
});
