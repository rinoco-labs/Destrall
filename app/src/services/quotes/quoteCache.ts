import type { AftermathTradeRoute } from "../../main/services/chains/sui/aftermath-router-api";

const DEFAULT_TTL_MS = 2 * 60 * 1000;

type CacheEntry<T> = { value: T; expiresAtMs: number };

function cacheKey(parts: string[]): string {
  return parts.join("|");
}

class TimedCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(private readonly defaultTtlMs: number) {}

  get(key: string): T | undefined {
    const row = this.store.get(key);
    if (!row) return undefined;
    if (Date.now() > row.expiresAtMs) {
      this.store.delete(key);
      return undefined;
    }
    return row.value;
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    this.store.set(key, { value, expiresAtMs: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}

export const swapRouteCache = new TimedCache<AftermathTradeRoute>(DEFAULT_TTL_MS);

export const poolListCache = new TimedCache<unknown>(5 * 60 * 1000);

export function swapRouteCacheKey(params: {
  env: string;
  coinInType: string;
  coinOutType: string;
  coinInAmountRaw: string;
}): string {
  return cacheKey([params.env, params.coinInType, params.coinOutType, params.coinInAmountRaw]);
}
