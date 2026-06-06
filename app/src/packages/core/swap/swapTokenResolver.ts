import type { TokenBalanceView } from "../../../types/blockchain";
import { decimalStringToRawAmount } from "../../../main/services/chains/amount-utils";
import { resolveWalletToken } from "../../../services/tokens/walletTokenResolver";
import { validateSpendAmount } from "../../../services/tokens/balanceValidation";

export type FromWalletResolveOk = { kind: "ok"; balance: TokenBalanceView };
export type FromWalletResolveErr = { kind: "error"; message: string; code?: string };

/**
 * Pick the wallet balance row the user intends to spend.
 */
export function resolveSpendTokenFromWallet(params: {
  userToken: string;
  balances: TokenBalanceView[];
  walletAddress?: string;
}): FromWalletResolveOk | FromWalletResolveErr {
  const result = resolveWalletToken(params.userToken, params.balances, {
    requirePositiveBalance: true,
    walletAddress: params.walletAddress,
    logContext: "swap_spend",
  });

  if (result.kind === "resolved") {
    return { kind: "ok", balance: result.balance };
  }
  if (result.kind === "ambiguous") {
    const labels = result.candidates.map((c) => `${c.symbol} (${c.balanceFormatted})`).join(", ");
    return {
      kind: "error",
      code: "ambiguous_token",
      message: `I found multiple tokens matching "${params.userToken}": ${labels}. Specify the full coin type or pick from your portfolio.`,
    };
  }
  return { kind: "error", code: "unknown_token", message: result.message };
}

export function assertSwapSpendWithinBalance(params: {
  amountDisplay: string;
  decimals: number;
  balance: TokenBalanceView;
}): { ok: true; amountRaw: bigint } | { ok: false; message: string } {
  const check = validateSpendAmount({
    amountDisplay: params.amountDisplay,
    balance: params.balance,
    actionLabel: "This swap",
  });
  if (!check.ok) return { ok: false, message: check.message };
  return { ok: true, amountRaw: check.amountRaw };
}
