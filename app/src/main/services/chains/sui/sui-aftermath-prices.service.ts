import { Aftermath } from "aftermath-ts-sdk";
import type { TokenBalanceView } from "../../../../types/blockchain";
import type { SuiChainEnvironment } from "../../../../config/chains/sui";
import { getSuiRpcUrl } from "../../../../config/chains/sui";
import { normalizeSuiCoinType } from "./sui-coin-type-normalize";

const usdDisplay = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

/** One initialized SDK client per Sui cluster (lazy). */
const aftermathClientByEnv = new Map<SuiChainEnvironment, Promise<Aftermath | null>>();

function aftermathNetworkName(env: SuiChainEnvironment): "MAINNET" | "TESTNET" | null {
  if (env === "mainnet") return "MAINNET";
  if (env === "testnet") return "TESTNET";
  return null;
}

async function getAftermathClient(env: SuiChainEnvironment): Promise<Aftermath | null> {
  const name = aftermathNetworkName(env);
  if (!name) return null;

  let pending = aftermathClientByEnv.get(env);
  if (!pending) {
    pending = (async () => {
      try {
        const client = new Aftermath(name);
        await client.init({ fullnodeUrl: getSuiRpcUrl(env) });
        return client;
      } catch (e) {
        console.warn("[aftermath-prices] Aftermath.init failed", e instanceof Error ? e.message : e);
        aftermathClientByEnv.delete(env);
        return null;
      }
    })();
    aftermathClientByEnv.set(env, pending);
  }
  return pending;
}

export type AftermathNormalizedPriceInfo = {
  priceUsd: number;
  change24hPct: number;
};

/**
 * Spot USD price and 24h % change keyed by {@link normalizeSuiCoinType} (Aftermath `getCoinsToPriceInfo`).
 */
export async function fetchAftermathPriceInfoByNormalizedCoinType(
  env: SuiChainEnvironment,
  coinTypes: string[],
): Promise<Map<string, AftermathNormalizedPriceInfo>> {
  const out = new Map<string, AftermathNormalizedPriceInfo>();
  if (coinTypes.length === 0) return out;

  const client = await getAftermathClient(env);
  if (!client) return out;

  const normalizedUnique = [...new Set(coinTypes.map((c) => normalizeSuiCoinType(c)))];
  try {
    const pricesApi = client.Prices();
    const record = await pricesApi.getCoinsToPriceInfo({ coins: normalizedUnique });
    for (const [key, raw] of Object.entries(record as Record<string, unknown>)) {
      if (!raw || typeof raw !== "object") continue;
      const price = (raw as { price?: unknown }).price;
      const change24hPct = (raw as { priceChange24HoursPercentage?: unknown })
        .priceChange24HoursPercentage;
      if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) continue;
      const pct =
        typeof change24hPct === "number" && Number.isFinite(change24hPct) ? change24hPct : 0;
      out.set(normalizeSuiCoinType(key), { priceUsd: price, change24hPct: pct });
    }
  } catch (e) {
    console.warn("[aftermath-prices] getCoinsToPriceInfo failed", e instanceof Error ? e.message : e);
  }
  return out;
}

function tokenHumanAmount(balanceRaw: string, decimals: number): number {
  try {
    const raw = BigInt(balanceRaw);
    return Number(raw) / 10 ** decimals;
  } catch {
    return NaN;
  }
}

/**
 * Attaches `usdValue` (formatted USD) to each balance row when Aftermath returns a price.
 * No-op on devnet or when pricing fails.
 */
export async function enrichSuiBalancesWithAftermathUsd(
  env: SuiChainEnvironment,
  rows: TokenBalanceView[],
): Promise<TokenBalanceView[]> {
  if (rows.length === 0 || env === "devnet") return rows;

  const infoByNorm = await fetchAftermathPriceInfoByNormalizedCoinType(
    env,
    rows.map((r) => r.coinType),
  );

  return rows.map((b) => {
    const n = normalizeSuiCoinType(b.coinType);
    const info = infoByNorm.get(n);
    if (info == null) return { ...b };

    const human = tokenHumanAmount(b.balanceRaw, b.decimals);
    if (!Number.isFinite(human)) return { ...b };

    const usd = human * info.priceUsd;
    if (!Number.isFinite(usd) || usd <= 0) return { ...b };

    return {
      ...b,
      usdValue: usdDisplay.format(usd),
      usdPricePerUnit: info.priceUsd,
      usdPriceChange24hPct: info.change24hPct,
    };
  });
}
