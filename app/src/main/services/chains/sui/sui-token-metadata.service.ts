import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { SUI_COIN_TYPE } from "../../../../config/chains/sui";
import { getSwappableTokenByAddress } from "../../../../services/tokens/swappableTokenRegistry";
import { getNormalizedSuiCoinType, normalizeSuiCoinType } from "./sui-coin-type-normalize";

export type CoinMetadataRow = {
  symbol: string;
  decimals: number;
  name: string;
  iconUrl?: string | null;
};

const cache = new Map<string, CoinMetadataRow>();

function cacheKey(coinType: string): string {
  return coinType.includes("::") ? normalizeSuiCoinType(coinType) : coinType.trim();
}

function coinTypeLookupVariants(coinType: string): string[] {
  const trimmed = coinType.trim();
  if (!trimmed.includes("::")) return [trimmed];
  const normalized = normalizeSuiCoinType(trimmed);
  return normalized === trimmed ? [normalized] : [trimmed, normalized];
}

function registryDecimals(coinType: string): number | undefined {
  const entry = getSwappableTokenByAddress("sui", coinType);
  if (entry && typeof entry.decimals === "number" && Number.isFinite(entry.decimals)) {
    return entry.decimals;
  }
  return undefined;
}

function guessFromCoinType(coinType: string): CoinMetadataRow {
  const parts = coinType.split("::");
  const tail = parts[parts.length - 1] ?? coinType;
  const fromRegistry = registryDecimals(coinType);
  return {
    symbol: tail.slice(0, 12),
    decimals: fromRegistry ?? 9,
    name: tail,
    iconUrl: null,
  };
}

function storeCached(coinType: string, row: CoinMetadataRow): CoinMetadataRow {
  const key = cacheKey(coinType);
  cache.set(key, row);
  return row;
}

export class SuiTokenMetadataService {
  constructor(private readonly getClient: () => SuiJsonRpcClient) {}

  async getCoinMetadata(coinType: string): Promise<CoinMetadataRow> {
    const key = cacheKey(coinType);
    const hit = cache.get(key);
    if (hit) return hit;

    const normSui = getNormalizedSuiCoinType();
    if (key === normSui || coinType.trim() === SUI_COIN_TYPE) {
      return storeCached(coinType, {
        symbol: "SUI",
        decimals: 9,
        name: "Sui",
        iconUrl: null,
      });
    }

    const client = this.getClient();
    for (const variant of coinTypeLookupVariants(coinType)) {
      try {
        const meta = await client.getCoinMetadata({ coinType: variant });
        if (meta) {
          const registry = registryDecimals(variant);
          const decimals =
            typeof meta.decimals === "number" && meta.decimals > 0
              ? meta.decimals
              : (registry ?? guessFromCoinType(variant).decimals);
          return storeCached(coinType, {
            symbol: meta.symbol ?? guessFromCoinType(variant).symbol,
            decimals,
            name: meta.name ?? meta.symbol ?? variant,
            iconUrl: meta.iconUrl ?? null,
          });
        }
      } catch (err) {
        console.warn(
          "[sui] getCoinMetadata failed (sanitized)",
          variant,
          err instanceof Error ? err.message : err,
        );
      }
    }

    return storeCached(coinType, guessFromCoinType(coinType));
  }

  peekCached(coinType: string): CoinMetadataRow | undefined {
    return cache.get(cacheKey(coinType));
  }
}
