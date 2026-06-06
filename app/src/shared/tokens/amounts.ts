/**
 * All token amount conversion must use resolved token decimals.
 * Do not hardcode 9 decimals except for confirmed SUI-only logic.
 *
 * Never use JavaScript floating point for token amount conversion.
 */

import type { TokenBalanceView } from "../../types/blockchain";

/** Confirmed SUI native coin decimals only — not a global token default. */
export const SUI_DECIMALS = 9;

export class TokenAmountError extends Error {
  readonly code: "invalid_amount" | "too_many_decimals" | "decimals_unresolved" | "non_positive";

  constructor(
    message: string,
    code: "invalid_amount" | "too_many_decimals" | "decimals_unresolved" | "non_positive",
  ) {
    super(message);
    this.name = "TokenAmountError";
    this.code = code;
  }
}

export function decimalsResolutionFailedMessage(): string {
  return "Could not load decimals for this token. Refresh balances and try again.";
}

export function tooManyDecimalPlacesMessage(symbol: string, decimals: number): string {
  return `${symbol} supports up to ${decimals} decimal places.`;
}

/** Read decimals from a wallet balance row; throws if missing or invalid. */
export function getTokenDecimalsFromBalance(balance: Pick<TokenBalanceView, "decimals" | "symbol">): number {
  const d = balance.decimals;
  if (typeof d !== "number" || !Number.isFinite(d) || d < 0 || d > 36) {
    throw new TokenAmountError(decimalsResolutionFailedMessage(), "decimals_unresolved");
  }
  return d;
}

/** Parse a human-readable decimal string into raw on-chain units (bigint). No floating point. */
export function parseTokenAmount(humanAmount: string, decimals: number, symbol?: string): bigint {
  const t = humanAmount.trim();
  if (!t || t === ".") {
    throw new TokenAmountError("Invalid amount", "invalid_amount");
  }
  if (t.startsWith("-")) {
    throw new TokenAmountError("Amount must be positive", "non_positive");
  }
  const parts = t.split(".");
  if (parts.length > 2) {
    throw new TokenAmountError("Invalid amount", "invalid_amount");
  }
  const [w = "0", fRaw = ""] = parts;
  if (!/^\d+$/.test(w)) {
    throw new TokenAmountError("Invalid amount", "invalid_amount");
  }
  if (fRaw && !/^\d+$/.test(fRaw)) {
    throw new TokenAmountError("Invalid amount", "invalid_amount");
  }
  if (fRaw.length > decimals) {
    const sym = symbol?.trim() || "This token";
    throw new TokenAmountError(tooManyDecimalPlacesMessage(sym, decimals), "too_many_decimals");
  }
  const f = fRaw.padEnd(decimals, "0");
  const bi = BigInt(w) * 10n ** BigInt(decimals) + (f.length ? BigInt(f) : 0n);
  if (bi <= 0n) {
    throw new TokenAmountError("Amount must be greater than zero", "non_positive");
  }
  return bi;
}

/** Format raw on-chain units as a human-readable decimal string. No floating point. */
export function formatTokenAmount(raw: bigint | string, decimals: number): string {
  const rawBig = typeof raw === "bigint" ? raw : BigInt(raw);
  if (decimals === 0) return rawBig.toString();
  const neg = rawBig < 0n;
  const v = neg ? -rawBig : rawBig;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = v % base;
  if (frac === 0n) return `${neg ? "-" : ""}${whole}`;
  const fracStr = frac
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}.${fracStr}`;
}

export type CompareTokenAmountResult = "lt" | "eq" | "gt";

export function compareTokenAmounts(
  rawAmount: bigint | string,
  balanceRawAmount: bigint | string,
): CompareTokenAmountResult {
  const a = typeof rawAmount === "bigint" ? rawAmount : BigInt(rawAmount);
  const b = typeof balanceRawAmount === "bigint" ? balanceRawAmount : BigInt(balanceRawAmount);
  if (a < b) return "lt";
  if (a > b) return "gt";
  return "eq";
}

export function insufficientBalanceMessage(params: {
  symbol: string;
  requiredRaw: bigint;
  availableRaw: bigint;
  decimals: number;
  actionLabel?: string;
}): string {
  const req = formatTokenAmount(params.requiredRaw, params.decimals);
  const avail = formatTokenAmount(params.availableRaw, params.decimals);
  const label = params.actionLabel ?? "This action";
  return `You have ${avail} ${params.symbol}, but ${label.toLowerCase()} requires ${req} ${params.symbol}.`;
}

export function logTokenAmountConversion(detail: {
  context: string;
  tokenInput?: string;
  resolvedSymbol?: string;
  coinType?: string;
  decimals?: number;
  humanAmount?: string;
  rawAmount?: string;
  balanceRaw?: string;
  validation?: string;
}): void {
  const coin = detail.coinType
    ? detail.coinType.length > 24
      ? `${detail.coinType.slice(0, 14)}…${detail.coinType.slice(-10)}`
      : detail.coinType
    : undefined;
  console.info(`[token-amounts] ${detail.context}`, {
    tokenInput: detail.tokenInput,
    resolvedSymbol: detail.resolvedSymbol,
    coinType: coin,
    decimals: detail.decimals,
    humanAmount: detail.humanAmount,
    rawAmount: detail.rawAmount,
    balanceRaw: detail.balanceRaw,
    validation: detail.validation,
  });
}
