import type { TokenBalanceView } from "../../../types/blockchain";
import { decimalStringToRawAmount } from "../../../main/services/chains/amount-utils";
import { expandUserTokenAlias } from "../../../services/tokens/swappableTokenRegistry";

export type FromWalletResolveOk = { kind: "ok"; balance: TokenBalanceView };
export type FromWalletResolveErr = { kind: "error"; message: string };

/**
 * Pick the wallet balance row the user intends to spend. Does not call Aftermath or the registry.
 */
export function resolveSpendTokenFromWallet(params: {
  userToken: string;
  balances: TokenBalanceView[];
}): FromWalletResolveOk | FromWalletResolveErr {
  const raw = params.userToken.trim();
  if (!raw) {
    return { kind: "error", message: "You do not have enough of that token to swap." };
  }

  const balances = params.balances;
  const display = expandUserTokenAlias(raw);
  const displayUpper = display.toUpperCase();

  const byExactType = balances.find((b) => b.coinType.toLowerCase() === raw.toLowerCase());
  if (byExactType) {
    if (BigInt(byExactType.balanceRaw) <= 0n) {
      return { kind: "error", message: `You do not have enough ${byExactType.symbol} to swap.` };
    }
    return { kind: "ok", balance: byExactType };
  }

  const candidates = balances.filter((b) => {
    if (b.symbol.toUpperCase() === displayUpper) return true;
    const tail = (b.coinType.split("::").pop() ?? "").toUpperCase();
    return tail === displayUpper;
  });

  const positive = candidates.filter((b) => BigInt(b.balanceRaw) > 0n);
  if (positive.length === 1) {
    const only = positive[0];
    if (only) return { kind: "ok", balance: only };
  }
  if (positive.length > 1) {
    return {
      kind: "error",
      message: `Multiple balances match “${raw}”. Try using the full coin type from your portfolio.`,
    };
  }

  const zeroBal = candidates[0];
  if (zeroBal) {
    return { kind: "error", message: `You do not have enough ${zeroBal.symbol} to swap.` };
  }

  return { kind: "error", message: `You do not have enough ${displayUpper} to swap.` };
}

export function assertSwapSpendWithinBalance(params: {
  amountDisplay: string;
  decimals: number;
  balance: TokenBalanceView;
}): { ok: true; amountRaw: bigint } | { ok: false; message: string } {
  try {
    const amountRaw = decimalStringToRawAmount(params.amountDisplay.trim(), params.decimals);
    if (amountRaw > BigInt(params.balance.balanceRaw)) {
      return { ok: false, message: `You do not have enough ${params.balance.symbol} to swap.` };
    }
    return { ok: true, amountRaw };
  } catch {
    return { ok: false, message: "Enter a valid swap amount." };
  }
}
