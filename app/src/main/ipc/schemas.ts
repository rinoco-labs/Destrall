import { z } from "zod";

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
  slippageBps: z.number().int().min(1).max(5000),
  appFeeBps: z.number().int().min(0).max(10_000),
  treasuryAddress: z.string().min(1).max(256).optional(),
  quoteExpiresAtMs: z.number().int(),
  completeRouteJson: z.string().min(1).max(4_000_000),
});

export const chainExecuteSwapSchema = z.object({
  accountId: z.string().min(1).max(128),
  proposalSnapshot: swapProposalSnapshotV1Schema,
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
