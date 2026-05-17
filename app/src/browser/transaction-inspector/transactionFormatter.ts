import { SUI_COIN_TYPE } from "../../config/chains/sui";

const KNOWN_COIN_SYMBOLS: Record<string, string> = {
  [SUI_COIN_TYPE]: "SUI",
  "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI": "SUI",
};

const KNOWN_DAPP_NAMES: Record<string, string> = {
  "flowx.finance": "FlowX",
  "www.flowx.finance": "FlowX",
  "app.cetus.zone": "Cetus",
  "cetus.zone": "Cetus",
  "aftermath.finance": "Aftermath",
  "app.navi.ag": "Navi",
  "navi.ag": "Navi",
  "suilend.com": "Suilend",
  "app.suilend.com": "Suilend",
};

export function formatAddress(address: string, head = 6, tail = 4): string {
  const trimmed = address.trim();
  if (trimmed.length <= head + tail + 3) return trimmed;
  return `${trimmed.slice(0, head)}…${trimmed.slice(-tail)}`;
}

export function formatCoinType(coinType: string): { symbol: string; label: string } {
  const normalized = coinType.trim();
  const known = KNOWN_COIN_SYMBOLS[normalized];
  if (known) return { symbol: known, label: known };

  const match = normalized.match(/::([^:]+)::([^:]+)$/);
  if (match) {
    const symbol = match[2].toUpperCase();
    return { symbol, label: symbol };
  }

  return { symbol: formatAddress(normalized, 8, 6), label: formatAddress(normalized, 10, 8) };
}

export function formatMistToDisplay(mist: bigint | number | string, symbol = "SUI"): string {
  const value = typeof mist === "bigint" ? mist : BigInt(String(mist));
  const units = Number(value) / 1_000_000_000;
  const abs = Math.abs(units);
  const formatted =
    abs >= 1000
      ? abs.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : abs >= 1
        ? abs.toFixed(4).replace(/\.?0+$/, "")
        : abs.toFixed(6).replace(/\.?0+$/, "");
  const prefix = units < 0 ? "-" : "";
  return `${prefix}${formatted} ${symbol}`;
}

export function resolveDappDisplayName(origin: string): { hostname: string; displayName: string } {
  try {
    const url = new URL(origin);
    const hostname = url.hostname.replace(/^www\./, "");
    const displayName = KNOWN_DAPP_NAMES[hostname] ?? KNOWN_DAPP_NAMES[url.hostname] ?? hostname;
    return { hostname, displayName };
  } catch {
    return { hostname: origin, displayName: "Unknown dapp" };
  }
}

export function prettyJson(value: unknown, maxLength = 12_000): string {
  try {
    const text = JSON.stringify(
      value,
      (_key, v) => {
        if (v instanceof Uint8Array) return `Uint8Array(${v.length})`;
        if (typeof v === "bigint") return v.toString();
        return v;
      },
      2,
    );
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}\n… (truncated)`;
  } catch {
    return String(value);
  }
}

export function decodeMessageFromBase64(messageBase64: string): string {
  const trimmed = messageBase64.replace(/\s+/g, "");
  try {
    const bytes = Buffer.from(trimmed, "base64");
    if (bytes.length === 0) return "";
    const utf8 = bytes.toString("utf8");
    if (/^[\x20-\x7E\s\u00A0-\uFFFF]*$/.test(utf8) && utf8.trim().length > 0) {
      return utf8.trim();
    }
    return `Binary message (${bytes.length} bytes)`;
  } catch {
    return messageBase64;
  }
}
