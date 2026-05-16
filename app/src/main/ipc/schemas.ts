import { z } from "zod";
import { swapProposalSnapshotV1Schema } from "../../packages/core/swap/swap.schemas";
import { naviYieldProposalSnapshotV1Schema } from "../../packages/core/yield/navi/navi.schemas";

export const walletCreateSchema = z.object({
  mnemonic: z.string().min(1),
  password: z.string().min(8),
  profileName: z.string().min(1).max(255).optional(),
  accountName: z.string().min(1).max(255).optional(),
  imported: z.boolean().optional(),
});

export const walletCreateAccountSchema = z.object({
  name: z.string().min(1).max(255),
});

export const walletAccountIdSchema = z.object({
  accountId: z.string().min(1).max(128),
});

export const walletRenameAccountSchema = z.object({
  accountId: z.string().min(1).max(128),
  name: z.string().min(1).max(255),
});

export const walletUpdateAccountIconSchema = z.object({
  accountId: z.string().min(1).max(128),
  icon: z.string().max(32).nullable().optional(),
  color: z.string().max(64).nullable().optional(),
});

export const walletUnlockSessionSchema = z.object({
  password: z.string().min(1),
});

export const walletViewSeedSchema = z.object({
  password: z.string().min(1),
});

const suiEnvSchema = z.enum(["mainnet", "testnet", "devnet"]);

export const chainSetNetworkSchema = z.object({
  activeChain: z.enum(["sui", "solana", "evm"]),
  suiEnvironment: suiEnvSchema,
});

export const chainAccountIdSchema = z.object({
  accountId: z.string().min(1).max(128),
});

export const chainPublishDailyBriefMemorySchema = z.object({
  accountId: z.string().min(1).max(128),
  memory: z.object({
    generatedAt: z.number(),
    accountSummary: z.string().max(2000),
    portfolioLine: z.string().max(2000),
    yieldLine: z.string().max(2000),
    riskLine: z.string().max(2000),
    opportunityLine: z.string().max(2000),
    recommendations: z.array(z.string().max(600)).max(16),
  }),
});

export const chainActivitySchema = z.object({
  accountId: z.string().min(1).max(128),
  cursor: z.string().max(256).nullable().optional(),
});

export const chainPrepareTransferSchema = z.object({
  accountId: z.string().min(1).max(128),
  recipient: z.string().min(1).max(256),
  coinType: z.string().min(1).max(512),
  amountDisplay: z.string().min(1).max(64),
});

export const chainConfirmTransferSchema = z.object({
  transferRequestId: z.string().min(1).max(128),
});

export { swapProposalSnapshotV1Schema };

export const chainExecuteSwapSchema = z.object({
  accountId: z.string().min(1).max(128),
  proposalSnapshot: swapProposalSnapshotV1Schema,
});

export const chainExecuteNaviYieldSchema = z.object({
  accountId: z.string().min(1).max(128),
  proposalSnapshot: naviYieldProposalSnapshotV1Schema,
});

const rebalanceSwapLegSchema = z.object({
  legId: z.string().uuid(),
  fromSymbol: z.string().min(1).max(32),
  toSymbol: z.string().min(1).max(32),
  amountDisplay: z.string().min(1).max(64),
  swapSnapshot: swapProposalSnapshotV1Schema,
});

export const rebalanceProposalSnapshotV1Schema = z.object({
  v: z.literal(1),
  proposalId: z.string().uuid(),
  accountId: z.string().min(1).max(128),
  suiEnvironment: suiEnvSchema,
  walletAddress: z.string().min(1).max(256),
  swapLegs: z.array(rebalanceSwapLegSchema).min(1).max(12),
  preparedAtMs: z.number().int(),
  expiresAtMs: z.number().int(),
});

import { compositeProposalSnapshotV1Schema } from "../../packages/runtime/composite/composite.schemas";

export { compositeProposalSnapshotV1Schema };

export const chainExecuteCompositeSchema = z.object({
  accountId: z.string().min(1).max(128),
  proposalSnapshot: compositeProposalSnapshotV1Schema,
});

export const chainExecuteRebalanceSchema = z.object({
  accountId: z.string().min(1).max(128),
  proposalSnapshot: rebalanceProposalSnapshotV1Schema,
});

const chainIdSchema = z.enum(["sui", "solana", "evm"]);

export const contactsListSchema = z.object({
  query: z.string().max(256).optional(),
});

export const contactsCreateSchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().min(1).max(256),
  chain: chainIdSchema,
  accountId: z.preprocess(
    (val) => {
      if (val == null || val === "") return null;
      if (typeof val === "string") {
        const t = val.trim();
        return t.length > 0 ? t : null;
      }
      return null;
    },
    z.string().max(128).nullable(),
  ),
});

export const contactsUpdateSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(255),
  address: z.string().min(1).max(256),
});

export const contactsDeleteSchema = z.object({
  id: z.string().min(1).max(128),
});
