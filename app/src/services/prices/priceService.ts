import type { SuiChainEnvironment } from "../../config/chains/sui";
import { networkSettingsService } from "../../main/services/network/networkSettingsService";
import { fetchAftermathPriceInfoByNormalizedCoinType } from "../../main/services/chains/sui/sui-aftermath-prices.service";
import { normalizeSuiCoinType } from "../../main/services/chains/sui/sui-coin-type-normalize";
import { getSwappableTokenBySymbol } from "../tokens/swappableTokenRegistry";

export type TokenPriceQuote = {
  symbol: string;
  coinType: string;
  priceUsd: number;
  change24hPct: number;
  source: "aftermath" | "unavailable";
  fetchedAt: string;
};

export type PriceProvider = {
  getTokenPrice(symbol: string, env: SuiChainEnvironment): Promise<TokenPriceQuote | null>;
};

const CACHE_TTL_MS = 45_000;
const cache = new Map<string, { quote: TokenPriceQuote; expiresAt: number }>();

function cacheKey(env: SuiChainEnvironment, coinType: string): string {
  return `${env}:${normalizeSuiCoinType(coinType)}`;
}

async function fetchPriceForCoinType(
  env: SuiChainEnvironment,
  symbol: string,
  coinType: string,
): Promise<TokenPriceQuote | null> {
  if (env === "devnet") return null;

  const ck = cacheKey(env, coinType);
  const hit = cache.get(ck);
  if (hit && hit.expiresAt > Date.now()) return hit.quote;

  const map = await fetchAftermathPriceInfoByNormalizedCoinType(env, [coinType]);
  const info = map.get(normalizeSuiCoinType(coinType));
  if (!info || info.priceUsd <= 0) {
    return null;
  }

  const quote: TokenPriceQuote = {
    symbol,
    coinType: normalizeSuiCoinType(coinType),
    priceUsd: info.priceUsd,
    change24hPct: info.change24hPct,
    source: "aftermath",
    fetchedAt: new Date().toISOString(),
  };
  cache.set(ck, { quote, expiresAt: Date.now() + CACHE_TTL_MS });
  return quote;
}

const aftermathProvider: PriceProvider = {
  async getTokenPrice(symbol: string, env: SuiChainEnvironment): Promise<TokenPriceQuote | null> {
    const entry = getSwappableTokenBySymbol("sui", symbol);
    if (!entry) return null;
    return fetchPriceForCoinType(env, entry.symbol, entry.coinType);
  },
};

/** Supported symbols for v1 price triggers (no fabricated prices). */
const SUPPORTED_SYMBOLS = new Set(["SUI", "USDC", "WAL", "DEEP"]);

export const priceService = {
  isSupportedSymbol(symbol: string): boolean {
    return SUPPORTED_SYMBOLS.has(symbol.trim().toUpperCase());
  },

  async getTokenPriceBySymbol(symbol: string): Promise<TokenPriceQuote | null> {
    const sym = symbol.trim().toUpperCase();
    if (!SUPPORTED_SYMBOLS.has(sym)) return null;
    const env = networkSettingsService.getSuiEnvironment();
    return aftermathProvider.getTokenPrice(sym, env);
  },

  async getTokenPriceByCoinType(coinType: string, symbolHint?: string): Promise<TokenPriceQuote | null> {
    const env = networkSettingsService.getSuiEnvironment();
    const sym =
      symbolHint?.trim().toUpperCase() ||
      getSwappableTokenBySymbol("sui", coinType)?.symbol ||
      "UNKNOWN";
    if (!SUPPORTED_SYMBOLS.has(sym) && sym !== "UNKNOWN") return null;
    return fetchPriceForCoinType(env, sym, coinType);
  },

  clearCache(): void {
    cache.clear();
  },
};
