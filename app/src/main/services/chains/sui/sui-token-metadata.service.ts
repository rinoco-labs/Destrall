import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { SUI_COIN_TYPE } from "../../../../config/chains/sui";
import { decimalsResolutionFailedMessage } from "../../../../shared/tokens/amounts";
import { getSwappableTokenByAddress } from "../../../../services/tokens/swappableTokenRegistry";
import { getNormalizedSuiCoinType, normalizeSuiCoinType } from "./sui-coin-type-normalize";

export type CoinMetadataRow = {
  symbol: string;
  decimals: number;
  name: string;
  iconUrl?: string | null;
};

export class CoinMetadataError extends Error {
  readonly coinType: string;

  constructor(coinType: string, message?: string) {
    super(message ?? decimalsResolutionFailedMessage());
    this.name = "CoinMetadataError";
    this.coinType = coinType;
  }
}

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

function symbolFromCoinType(coinType: string): string {
  const parts = coinType.split("::");
  const tail = parts[parts.length - 1] ?? coinType;
  return tail.slice(0, 12);
}

function resolveDecimalsOrThrow(coinType: string, rpcDecimals?: number): number {
  if (typeof rpcDecimals === "number" && Number.isFinite(rpcDecimals) && rpcDecimals > 0) {
    return rpcDecimals;
  }
  const fromRegistry = registryDecimals(coinType);
  if (fromRegistry !== undefined) return fromRegistry;
  throw new CoinMetadataError(coinType);
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
    let lastError: unknown;
    for (const variant of coinTypeLookupVariants(coinType)) {
      try {
        const meta = await client.getCoinMetadata({ coinType: variant });
        if (meta) {
          const decimals = resolveDecimalsOrThrow(variant, meta.decimals);
          return storeCached(coinType, {
            symbol: meta.symbol ?? symbolFromCoinType(variant),
            decimals,
            name: meta.name ?? meta.symbol ?? variant,
            iconUrl: meta.iconUrl ?? null,
          });
        }
      } catch (err) {
        if (err instanceof CoinMetadataError) throw err;
        lastError = err;
        console.warn(
          "[sui] getCoinMetadata failed (sanitized)",
          variant,
          err instanceof Error ? err.message : err,
        );
      }
    }

    const fromRegistry = registryDecimals(coinType);
    if (fromRegistry !== undefined) {
      return storeCached(coinType, {
        symbol: symbolFromCoinType(coinType),
        decimals: fromRegistry,
        name: symbolFromCoinType(coinType),
        iconUrl: null,
      });
    }

    throw new CoinMetadataError(coinType, lastError instanceof Error ? lastError.message : undefined);
  }

  peekCached(coinType: string): CoinMetadataRow | undefined {
    return cache.get(cacheKey(coinType));
  }
}
