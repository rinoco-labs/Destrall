import { z } from "zod";
import type { BrowserPersistedState } from "../../browser/types/browser.types";

export const nativeBrowserViewportBoundsSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().nonnegative(),
  height: z.number().finite().nonnegative(),
});

export const nativeBrowserNavigateSchema = z.string().min(1).max(4096);

export const nativeBrowserResolveWalletRequestSchema = z.object({
  id: z.string().min(1).max(128),
  result: z.unknown().optional(),
  error: z.string().max(4096).optional(),
});

export const nativeBrowserPersistAuthorizedAccountsSchema = z.object({
  origin: z.string().min(1).max(2048),
  chain: z.enum(["sui", "solana"]),
  accounts: z.array(
    z.object({
      address: z.string().min(1).max(512),
      publicKey: z.array(z.number().int().min(0).max(255)),
      chains: z.array(z.string().min(1).max(128)),
      features: z.array(z.string().min(1).max(128)),
    }),
  ),
});

export const nativeBrowserClearAuthorizedAccountsSchema = z.object({
  origin: z.string().min(1).max(2048),
});

export const browserAccountIdSchema = z.object({
  accountId: z.string().min(1).max(128),
});

export const browserReplaceStateSchema = z.object({
  accountId: z.string().min(1).max(128),
  state: z.custom<BrowserPersistedState>(),
});

export const browserAuthorizeDappSchema = z.object({
  accountId: z.string().min(1).max(128),
  origin: z.string().min(1).max(2048),
  displayName: z.string().min(1).max(512),
  accountAddress: z.string().min(1).max(512),
  network: z.string().min(1).max(128),
  permissions: z.array(
    z.enum(["viewAccount", "signMessage", "signTransaction", "executeTransaction"]),
  ),
});

export const browserWalletSignPersonalMessageSchema = z.object({
  accountId: z.string().min(1).max(128),
  origin: z.string().min(1).max(2048),
  messageBase64: z.string().min(1).max(65536),
});

export const browserWalletSignTransactionSchema = z.object({
  accountId: z.string().min(1).max(128),
  origin: z.string().min(1).max(2048),
  txDataJson: z.string().min(1).max(131072),
});

export const browserWalletConnectSchema = z.object({
  accountId: z.string().min(1).max(128),
  origin: z.string().min(1).max(2048),
  chain: z.enum(["sui", "solana"]),
  silent: z.boolean().optional(),
});

export const browserWalletDisconnectSchema = z.object({
  accountId: z.string().min(1).max(128),
  origin: z.string().min(1).max(2048),
  chain: z.enum(["sui", "solana"]),
});

export const browserPreviewTransactionSchema = z.object({
  accountId: z.string().min(1).max(128),
  txDataJson: z.string().min(1).max(131072),
});
