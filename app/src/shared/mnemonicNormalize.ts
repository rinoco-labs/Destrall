/**
 * Shared BIP-39 input normalization for renderer preview and main-process import.
 * Trim, NFKC, lowercase, collapse all whitespace (newlines, tabs, NBSP) into single spaces.
 */
export function normalizeMnemonicInput(input: string): string {
  return input
    .trim()
    .replace(/\u00a0/g, " ")
    .normalize("NFKC")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}
