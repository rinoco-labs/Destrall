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
