import { z } from "zod";
import { swapProposalSnapshotV1Schema } from "../../core/swap/swap.schemas";
import { naviYieldProposalSnapshotV1Schema } from "../../core/yield/navi/navi.schemas";

const suiEnvSchema = z.enum(["mainnet", "testnet", "devnet"]);

export const compositeProposalSnapshotV1Schema = z.object({
  v: z.literal(1),
  compositeId: z.string().uuid(),
  planId: z.string().uuid(),
  accountId: z.string().min(1).max(128),
  suiEnvironment: suiEnvSchema,
  walletAddress: z.string().min(1).max(256),
  executionModel: z.enum(["ptb", "staged"]),
  planJson: z.string().min(2).max(2_000_000),
  preparedAtMs: z.number().int(),
  expiresAtMs: z.number().int(),
  swapSnapshot: swapProposalSnapshotV1Schema.optional(),
  depositSnapshot: naviYieldProposalSnapshotV1Schema.optional(),
  slippageBps: z.number().int().optional(),
});
