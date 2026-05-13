import type { SuiChainEnvironment } from "../../config/chains/sui";
import { swappableTokensConfig } from "../../config/swappableTokens.config";
import { SuiTokenMetadataService } from "../../main/services/chains/sui/sui-token-metadata.service";
import { getSuiClientForEnvironment } from "../../main/services/chains/sui/sui-client.service";
import { normalizeSuiCoinType } from "../../main/services/chains/sui/sui-coin-type-normalize";

export type SwappableChainId = keyof typeof swappableTokensConfig;

export type SwappableTokenConfigEntry = {
  symbol: string;
  name: string;
  address: string;
  coinType: string;
  decimals?: number;
};

export type EnrichedSwappableToken = SwappableTokenConfigEntry & {
  decimals: number;
  iconUrl?: string;
};

const enrichCache = new Map<string, EnrichedSwappableToken>();

function cacheKey(chain: SwappableChainId, coinType: string, env: SuiChainEnvironment): string {
  return `${chain}:${coinType}:${env}`;
}

function normalizeInput(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Map common phrases to a config symbol (uppercase). */
function aliasToConfigSymbol(input: string): string | null {
  const n = normalizeInput(input);
  if (n === "sui") return "SUI";
  if (n === "usd coin" || n === "usdc" || n === "usd-coin") return "USDC";
  if (n === "deepbook" || n === "deep") return "DEEP";
  if (n === "walrus" || n === "wal") return "WAL";
  return null;
}

/** Normalized symbol phrase for matching wallet rows (e.g. "sui" → "SUI"). */
export function expandUserTokenAlias(input: string): string {
  const t = input.trim();
  if (!t) return t;
  return aliasToConfigSymbol(t) ?? t;
}

function chainTokens(chain: SwappableChainId): readonly SwappableTokenConfigEntry[] {
  return swappableTokensConfig[chain].tokens as readonly SwappableTokenConfigEntry[];
}

export function getSwappableTokens(chain: SwappableChainId): SwappableTokenConfigEntry[] {
  return [...chainTokens(chain)];
}

export function getSwappableTokenBySymbol(
  chain: SwappableChainId,
  symbol: string,
): SwappableTokenConfigEntry | null {
  const alias = aliasToConfigSymbol(symbol);
  const needle = (alias ?? symbol).trim();
  if (!needle) return null;
  const u = needle.toUpperCase();
  for (const t of chainTokens(chain)) {
    if (t.symbol.toUpperCase() === u) return { ...t };
  }
  return null;
}

export function getSwappableTokenByAddress(
  chain: SwappableChainId,
  address: string,
): SwappableTokenConfigEntry | null {
  const raw = address.trim();
  if (!raw) return null;
  if (chain === "sui" && raw.includes("::")) {
    const want = normalizeSuiCoinType(raw);
    for (const t of chainTokens(chain)) {
      if (normalizeSuiCoinType(t.coinType) === want) {
        return { ...t };
      }
    }
    return null;
  }
  const low = raw.toLowerCase();
  for (const t of chainTokens(chain)) {
    if (t.coinType.toLowerCase() === low || t.address.toLowerCase() === low) {
      return { ...t };
    }
  }
  return null;
}

/**
 * Resolve user text to a registry token: symbol, alias, or full coin type / package address string.
 */
export function resolveSwappableToken(
  chain: SwappableChainId,
  input: string,
): SwappableTokenConfigEntry | null {
  const raw = input.trim();
  if (!raw) return null;

  const byType = getSwappableTokenByAddress(chain, raw);
  if (byType) return byType;

  const alias = aliasToConfigSymbol(raw);
  if (alias) {
    const t = getSwappableTokenBySymbol(chain, alias);
    if (t) return t;
  }

  const n = normalizeInput(raw);
  for (const t of chainTokens(chain)) {
    if (t.symbol.toLowerCase() === n || t.name.toLowerCase() === n) {
      return { ...t };
    }
  }

  const tail = raw.includes("::") ? (raw.split("::").pop() ?? "").trim() : raw;
  if (tail && tail !== raw) {
    return getSwappableTokenBySymbol(chain, tail);
  }

  return getSwappableTokenBySymbol(chain, raw);
}

export function isTokenSwappable(chain: SwappableChainId, coinType: string): boolean {
  const raw = coinType.trim();
  if (!raw) return false;
  return getSwappableTokenByAddress(chain, raw) != null;
}

export async function enrichTokenMetadata(
  chain: SwappableChainId,
  token: SwappableTokenConfigEntry,
  network: SuiChainEnvironment,
): Promise<EnrichedSwappableToken> {
  const coinTypeKey = chain === "sui" ? normalizeSuiCoinType(token.coinType) : token.coinType.trim();

  if (typeof token.decimals === "number" && Number.isFinite(token.decimals)) {
    return { ...token, coinType: coinTypeKey, decimals: token.decimals };
  }

  if (chain !== "sui") {
    throw new Error(`Cannot enrich token metadata for chain ${chain} without configured decimals.`);
  }

  const ck = cacheKey(chain, coinTypeKey, network);
  const hit = enrichCache.get(ck);
  if (hit) return hit;

  const meta = new SuiTokenMetadataService(() => getSuiClientForEnvironment(network));
  const m = await meta.getCoinMetadata(coinTypeKey);
  const enriched: EnrichedSwappableToken = {
    ...token,
    coinType: coinTypeKey,
    decimals: m.decimals,
    iconUrl: m.iconUrl ?? undefined,
  };
  enrichCache.set(ck, enriched);
  return enriched;
}
