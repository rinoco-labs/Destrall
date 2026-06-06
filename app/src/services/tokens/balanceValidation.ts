import type { TokenBalanceView } from "../../types/blockchain";
import {
  compareTokenAmounts,
  formatTokenAmount,
  getTokenDecimalsFromBalance,
  insufficientBalanceMessage,
  parseTokenAmount,
  TokenAmountError,
  tooManyDecimalPlacesMessage,
} from "../../shared/tokens/amounts";

export type SpendAmountCheck =
  | { ok: true; amountRaw: bigint }
  | { ok: false; message: string; code: "invalid_amount" | "insufficient_funds" | "decimals_unresolved" };

export function validateSpendAmount(params: {
  amountDisplay: string;
  balance: TokenBalanceView;
  actionLabel?: string;
}): SpendAmountCheck {
  const label = params.actionLabel ?? "This action";
  try {
    const decimals = getTokenDecimalsFromBalance(params.balance);
    const amountRaw = parseTokenAmount(params.amountDisplay.trim(), decimals, params.balance.symbol);
    const available = BigInt(params.balance.balanceRaw);
    if (compareTokenAmounts(amountRaw, available) === "gt") {
      return {
        ok: false,
        code: "insufficient_funds",
        message: insufficientBalanceMessage({
          symbol: params.balance.symbol,
          requiredRaw: amountRaw,
          availableRaw: available,
          decimals,
          actionLabel: label,
        }),
      };
    }
    return { ok: true, amountRaw };
  } catch (e) {
    if (e instanceof TokenAmountError) {
      if (e.code === "too_many_decimals") {
        return { ok: false, code: "invalid_amount", message: e.message };
      }
      if (e.code === "decimals_unresolved") {
        return { ok: false, code: "decimals_unresolved", message: e.message };
      }
      return { ok: false, code: "invalid_amount", message: e.message };
    }
    const msg = e instanceof Error ? e.message : "Invalid amount";
    return { ok: false, code: "invalid_amount", message: msg };
  }
}

export function formatAvailableWalletTokens(balances: TokenBalanceView[], limit = 8): string {
  const positive = balances.filter((b) => {
    try {
      return BigInt(b.balanceRaw) > 0n;
    } catch {
      return false;
    }
  });
  if (positive.length === 0) return "none";
  const syms = [...new Set(positive.map((b) => b.symbol))].slice(0, limit);
  const suffix = positive.length > limit ? ", …" : "";
  return syms.join(", ") + suffix;
}

export function shortenCoinType(coinType: string): string {
  const t = coinType.trim();
  if (t.length <= 24) return t;
  return `${t.slice(0, 14)}…${t.slice(-10)}`;
}

export { tooManyDecimalPlacesMessage, formatTokenAmount, parseTokenAmount, getTokenDecimalsFromBalance };
