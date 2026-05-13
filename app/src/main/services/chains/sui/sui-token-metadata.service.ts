import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { SUI_COIN_TYPE } from "../../../../config/chains/sui";

export type CoinMetadataRow = {
  symbol: string;
  decimals: number;
  name: string;
  iconUrl?: string | null;
};

const cache = new Map<string, CoinMetadataRow>();

function guessFromCoinType(coinType: string): CoinMetadataRow {
  const parts = coinType.split("::");
  const tail = parts[parts.length - 1] ?? coinType;
  return {
    symbol: tail.slice(0, 12),
    decimals: 9,
    name: tail,
    iconUrl: null,
  };
}

export class SuiTokenMetadataService {
  constructor(private readonly getClient: () => SuiJsonRpcClient) {}

  async getCoinMetadata(coinType: string): Promise<CoinMetadataRow> {
    const hit = cache.get(coinType);
    if (hit) return hit;

    if (coinType === SUI_COIN_TYPE) {
      const row: CoinMetadataRow = {
        symbol: "SUI",
        decimals: 9,
        name: "Sui",
        iconUrl: null,
      };
      cache.set(coinType, row);
      return row;
    }

    try {
      const client = this.getClient();
      const meta = await client.getCoinMetadata({ coinType });
      if (meta) {
        const row: CoinMetadataRow = {
          symbol: meta.symbol ?? guessFromCoinType(coinType).symbol,
          decimals: meta.decimals ?? 0,
          name: meta.name ?? meta.symbol ?? coinType,
          iconUrl: meta.iconUrl ?? null,
        };
        cache.set(coinType, row);
        return row;
      }
    } catch (err) {
      console.warn("[sui] getCoinMetadata failed (sanitized)", coinType, err instanceof Error ? err.message : err);
    }

    const fallback = guessFromCoinType(coinType);
    cache.set(coinType, fallback);
    return fallback;
  }

  peekCached(coinType: string): CoinMetadataRow | undefined {
    return cache.get(coinType);
  }
}
