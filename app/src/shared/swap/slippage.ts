/**
 * Aftermath expects slippage as a decimal fraction. Example: 0.01 = 1%.
 * Do not pass percentage integers or basis points directly.
 */

export const DEFAULT_SLIPPAGE_DECIMAL = 0.01;
export const DEFAULT_SLIPPAGE_BPS = 100;
export const MIN_SLIPPAGE_DECIMAL = 0.001;
export const MAX_SLIPPAGE_DECIMAL = 0.05;
export const MIN_SLIPPAGE_BPS = 10;
export const MAX_SLIPPAGE_BPS = 500;

export type SlippageInputFormat = "decimal" | "percent" | "bps";

export class SlippageError extends Error {
  readonly code: "invalid" | "too_low" | "too_high";

  constructor(message: string, code: "invalid" | "too_low" | "too_high" = "invalid") {
    super(message);
    this.name = "SlippageError";
    this.code = code;
  }
}

function parsePercentString(raw: string): number {
  const t = raw.trim().replace(/%$/, "").trim();
  if (!t) throw new SlippageError("Invalid slippage value.");
  const n = Number(t);
  if (!Number.isFinite(n)) throw new SlippageError("Invalid slippage value.");
  return n / 100;
}

function rawToDecimal(value: number, inputFormat: SlippageInputFormat): number {
  if (!Number.isFinite(value)) throw new SlippageError("Invalid slippage value.");
  if (value <= 0) throw new SlippageError("Slippage must be greater than zero.", "too_low");
  switch (inputFormat) {
    case "decimal":
      return value;
    case "percent":
      return value / 100;
    case "bps":
      return value / 10_000;
    default:
      throw new SlippageError("Invalid slippage input format.");
  }
}

export function validateSlippage(value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new SlippageError("Slippage must be greater than zero.", "too_low");
  }
  if (value < MIN_SLIPPAGE_DECIMAL) {
    throw new SlippageError(
      `Slippage must be at least ${formatSlippageForDisplay(MIN_SLIPPAGE_DECIMAL)}.`,
      "too_low",
    );
  }
  if (value > MAX_SLIPPAGE_DECIMAL) {
    throw new SlippageError(
      `Slippage cannot exceed ${formatSlippageForDisplay(MAX_SLIPPAGE_DECIMAL)}.`,
      "too_high",
    );
  }
}

export function normalizeSlippage(
  input: unknown,
  opts?: { inputFormat?: SlippageInputFormat },
): number {
  const inputFormat = opts?.inputFormat ?? "decimal";

  if (input === undefined || input === null) {
    return DEFAULT_SLIPPAGE_DECIMAL;
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return DEFAULT_SLIPPAGE_DECIMAL;
    if (trimmed.endsWith("%")) {
      const decimal = parsePercentString(trimmed);
      validateSlippage(decimal);
      return decimal;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) throw new SlippageError("Invalid slippage value.");
    const decimal = rawToDecimal(n, inputFormat);
    validateSlippage(decimal);
    return decimal;
  }

  if (typeof input === "number") {
    const decimal = rawToDecimal(input, inputFormat);
    validateSlippage(decimal);
    return decimal;
  }

  throw new SlippageError("Invalid slippage value.");
}

export function slippageDecimalToBps(decimal: number): number {
  validateSlippage(decimal);
  return Math.round(decimal * 10_000);
}

export function slippageBpsToDecimal(bps: number): number {
  if (!Number.isFinite(bps)) throw new SlippageError("Invalid slippage value.");
  return normalizeSlippage(bps, { inputFormat: "bps" });
}

export function toAftermathSlippage(bps: number): number {
  return slippageBpsToDecimal(bps);
}

export function formatSlippageForDisplay(decimal: number): string {
  const pct = decimal * 100;
  if (pct >= 1) return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2).replace(/\.?0+$/, "")}%`;
  return `${pct.toFixed(2).replace(/\.?0+$/, "")}%`;
}

export function formatSlippageBpsForDisplay(bps: number): string {
  return formatSlippageForDisplay(slippageBpsToDecimal(bps));
}

export function resolveSwapSlippageBps(input: unknown): number {
  const decimal = normalizeSlippage(input ?? DEFAULT_SLIPPAGE_DECIMAL, { inputFormat: "bps" });
  const bps = slippageDecimalToBps(decimal);
  if (bps < MIN_SLIPPAGE_BPS) {
    throw new SlippageError(
      `Slippage must be at least ${formatSlippageBpsForDisplay(MIN_SLIPPAGE_BPS)} (${MIN_SLIPPAGE_BPS} bps).`,
      "too_low",
    );
  }
  if (bps > MAX_SLIPPAGE_BPS) {
    throw new SlippageError(
      `Slippage cannot exceed ${formatSlippageBpsForDisplay(MAX_SLIPPAGE_BPS)} (${MAX_SLIPPAGE_BPS} bps).`,
      "too_high",
    );
  }
  return bps;
}

function shortenCoinType(coinType: string | undefined): string | undefined {
  if (!coinType) return undefined;
  const t = coinType.trim();
  if (t.length <= 24) return t;
  return `${t.slice(0, 14)}…${t.slice(-10)}`;
}

export function logAftermathSlippage(
  context: string,
  detail: {
    slippage: number;
    slippageBps?: number;
    coinInType?: string;
    coinOutType?: string;
    coinInAmountRaw?: string;
    coinOutAmountRaw?: string;
    walletAddress?: string;
  },
): void {
  const wallet = detail.walletAddress
    ? detail.walletAddress.length > 12
      ? `${detail.walletAddress.slice(0, 8)}…`
      : detail.walletAddress
    : undefined;
  console.info(`[aftermath] ${context}`, {
    slippage: detail.slippage,
    slippageDisplay: formatSlippageForDisplay(detail.slippage),
    slippageBps: detail.slippageBps,
    coinInType: shortenCoinType(detail.coinInType),
    coinOutType: shortenCoinType(detail.coinOutType),
    coinInAmountRaw: detail.coinInAmountRaw,
    coinOutAmountRaw: detail.coinOutAmountRaw,
    wallet,
  });
}
