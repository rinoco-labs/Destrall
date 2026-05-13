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

/**
 * USD prices keyed by {@link normalizeSuiCoinType} so lookups align with Aftermath responses.
 */
export async function fetchAftermathUsdPricesByNormalizedCoinType(
  env: SuiChainEnvironment,
  coinTypes: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (coinTypes.length === 0) return out;

  const client = await getAftermathClient(env);
  if (!client) return out;

  const normalizedUnique = [...new Set(coinTypes.map((c) => normalizeSuiCoinType(c)))];
  try {
    const pricesApi = client.Prices();
    const record = await pricesApi.getCoinsToPrice({ coins: normalizedUnique });
    for (const [key, price] of Object.entries(record)) {
      if (typeof price === "number" && Number.isFinite(price) && price > 0) {
        out.set(normalizeSuiCoinType(key), price);
      }
    }
  } catch (e) {
    console.warn("[aftermath-prices] getCoinsToPrice failed", e instanceof Error ? e.message : e);
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

  const priceByNorm = await fetchAftermathUsdPricesByNormalizedCoinType(
    env,
    rows.map((r) => r.coinType),
  );

  return rows.map((b) => {
    const n = normalizeSuiCoinType(b.coinType);
    const price = priceByNorm.get(n);
    if (price == null) return { ...b };

    const human = tokenHumanAmount(b.balanceRaw, b.decimals);
    if (!Number.isFinite(human)) return { ...b };

    const usd = human * price;
    if (!Number.isFinite(usd) || usd <= 0) return { ...b };

    return { ...b, usdValue: usdDisplay.format(usd) };
  });
}
