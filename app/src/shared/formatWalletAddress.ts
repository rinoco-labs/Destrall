export type FormatWalletAddressOptions = {
  /** Total visible characters from the start, including the `0x` prefix. Default 8 (`0x` + 6 hex). */
  start?: number;
  /** Visible characters from the end. Default 6. */
  end?: number;
  /** Middle separator. Default `...`. */
  ellipsis?: string;
};

const DEFAULT_START = 8;
const DEFAULT_END = 6;
const DEFAULT_ELLIPSIS = "...";

/** Long hex address after `0x` (used for detection inside free-form text). */
export const WALLET_ADDRESS_PATTERN = /(?<![0-9a-fA-F])(0x[0-9a-fA-F]{8,})(?![0-9a-fA-F])/i;

export function textContainsWalletAddress(text: string): boolean {
  return WALLET_ADDRESS_PATTERN.test(text);
}

export function looksLikeWalletAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{8,}$/i.test(value.trim());
}

export function shouldShortenWalletAddress(
  address: string,
  options?: FormatWalletAddressOptions,
): boolean {
  const start = options?.start ?? DEFAULT_START;
  const end = options?.end ?? DEFAULT_END;
  const ellipsis = options?.ellipsis ?? DEFAULT_ELLIPSIS;
  const trimmed = address.trim();
  if (!looksLikeWalletAddress(trimmed)) return false;
  return trimmed.length > start + end + ellipsis.length;
}

export function formatWalletAddress(
  address: string,
  options?: FormatWalletAddressOptions,
): string {
  const start = options?.start ?? DEFAULT_START;
  const end = options?.end ?? DEFAULT_END;
  const ellipsis = options?.ellipsis ?? DEFAULT_ELLIPSIS;
  const trimmed = address.trim();
  if (!shouldShortenWalletAddress(trimmed, { start, end, ellipsis })) {
    return address;
  }
  return `${trimmed.slice(0, start)}${ellipsis}${trimmed.slice(-end)}`;
}

export type WalletAddressTextSegment =
  | { type: "text"; value: string }
  | { type: "address"; value: string; display: string };

export function splitTextByWalletAddresses(
  text: string,
  options?: FormatWalletAddressOptions,
): WalletAddressTextSegment[] {
  if (!text) return [];

  const segments: WalletAddressTextSegment[] = [];
  const re = new RegExp(WALLET_ADDRESS_PATTERN.source, "gi");
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const full = match[1];
    const start = match.index;
    if (start > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, start) });
    }
    segments.push({
      type: "address",
      value: full,
      display: formatWalletAddress(full, options),
    });
    lastIndex = start + full.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}

/** Display-only helper: shortens embedded wallet addresses without mutating stored text. */
export function formatTextWithWalletAddresses(
  text: string,
  options?: FormatWalletAddressOptions,
): string {
  return splitTextByWalletAddresses(text, options)
    .map((seg) => (seg.type === "address" ? seg.display : seg.value))
    .join("");
}
