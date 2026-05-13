/** Parse a user decimal string into raw on-chain units (integer). No floating point. */
export function decimalStringToRawAmount(input: string, decimals: number): bigint {
  const t = input.trim();
  if (!t || t === ".") {
    throw new Error("Invalid amount");
  }
  if (t.startsWith("-")) {
    throw new Error("Amount must be positive");
  }
  const parts = t.split(".");
  if (parts.length > 2) {
    throw new Error("Invalid amount");
  }
  const [w = "0", fRaw = ""] = parts;
  if (!/^\d+$/.test(w)) {
    throw new Error("Invalid amount");
  }
  if (fRaw && !/^\d+$/.test(fRaw)) {
    throw new Error("Invalid amount");
  }
  if (fRaw.length > decimals) {
    throw new Error(`Too many decimal places (max ${decimals})`);
  }
  const f = fRaw.padEnd(decimals, "0");
  const bi = BigInt(w) * 10n ** BigInt(decimals) + (f.length ? BigInt(f) : 0n);
  if (bi <= 0n) {
    throw new Error("Amount must be greater than zero");
  }
  return bi;
}
