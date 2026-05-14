import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { SuiChainEnvironment } from "../../../../config/chains/sui";
import { getSuiClientForEnvironment } from "../../../../main/services/chains/sui/sui-client.service";
import { NAVI_POOL_CONFIGS, NAVI_RESERVE_PARENT_ID } from "./navi-onchain-pool-config";
import { fetchNaviConfig, NAVI_POOLS_API, safeFetchJson } from "./navi-config.service";
import type { NaviPoolRow } from "./navi.types";
import { riskLabelForSymbol } from "./navi-risk.service";

let cachedPools: NaviPoolRow[] | null = null;
let lastPoolFetchTime = 0;
const CACHE_TTL = 5 * 60_000;

function normalizeCoinType(ct: string): string {
  if (!ct) return "";
  const s = String(ct).trim();
  if (s.startsWith("0x")) return s;
  return `0x${s}`;
}

function safeParseFloat(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  const parsed = parseFloat(String(val));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseApyValue(apyInfo: unknown): number {
  if (!apyInfo || typeof apyInfo !== "object") return 0;
  const o = apyInfo as Record<string, unknown>;
  const apyField = o.apy ?? o.supplyApy ?? o.totalApy;
  if (apyField !== undefined && apyField !== null) {
    const val = safeParseFloat(apyField);
    if (val > 0) return val;
  }
  const vaultApr = safeParseFloat(o.vaultApr);
  const boostedApr = safeParseFloat(o.boostedApr);
  if (vaultApr + boostedApr > 0) {
    return vaultApr + boostedApr;
  }
  return 0;
}

function parseSupplyRateToApy(rawRate: unknown): number {
  const rate = safeParseFloat(rawRate);
  if (rate <= 0) return 0;
  const apy = rate > 1e12 ? rate / 1e25 : rate;
  return Number.isFinite(apy) && apy > 0 ? apy : 0;
}

async function readReserveFields(client: SuiJsonRpcClient, assetId: number): Promise<Record<string, unknown> | null> {
  try {
    const result = await client.getDynamicFieldObject({
      parentId: NAVI_RESERVE_PARENT_ID,
      name: { type: "u8", value: assetId },
    });
    const fields = (result.data?.content as { fields?: { value?: { fields?: Record<string, unknown> } } } | undefined)
      ?.fields?.value?.fields;
    return fields ?? null;
  } catch {
    return null;
  }
}

async function fetchNaviPoolsFromOnChain(env: SuiChainEnvironment): Promise<NaviPoolRow[]> {
  if (env !== "mainnet") {
    return [];
  }
  try {
    const client = getSuiClientForEnvironment(env);
    const pools: NaviPoolRow[] = [];
    for (const poolCfg of NAVI_POOL_CONFIGS) {
      const fields = await readReserveFields(client, poolCfg.assetId);
      const supplyApy = parseSupplyRateToApy(fields?.current_supply_rate);
      if (supplyApy <= 0) continue;
      pools.push({
        assetId: poolCfg.assetId,
        oracleId: poolCfg.assetId,
        coinType: normalizeCoinType(poolCfg.coinType),
        symbol: poolCfg.symbol,
        decimals: poolCfg.decimals,
        supplyApy,
        borrowApy: parseSupplyRateToApy(fields?.current_borrow_rate),
        totalSupplyRaw: String(
          (fields?.supply_balance as { fields?: { total_supply?: string } } | undefined)?.fields?.total_supply ?? "0",
        ),
        totalBorrowRaw: String(
          (fields?.borrow_balance as { fields?: { total_supply?: string } } | undefined)?.fields?.total_supply ?? "0",
        ),
        reserveId: poolCfg.reserveObjectId,
        poolObjectId: poolCfg.reserveObjectId,
        risk: riskLabelForSymbol(poolCfg.symbol),
      });
    }
    pools.sort((a, b) => b.supplyApy - a.supplyApy);
    return pools;
  } catch {
    return [];
  }
}

export async function fetchNaviPools(env: SuiChainEnvironment, forceRefresh = false): Promise<NaviPoolRow[]> {
  const now = Date.now();
  if (!forceRefresh && cachedPools && now - lastPoolFetchTime < CACHE_TTL) {
    return cachedPools;
  }

  try {
    const json = (await safeFetchJson(NAVI_POOLS_API, {
      headers: { Accept: "application/json" },
    })) as { data?: unknown[] };
    const rawPools = json?.data;
    if (!Array.isArray(rawPools)) {
      throw new Error("Invalid pools response");
    }

    const pools: NaviPoolRow[] = rawPools
      .filter((p: { status?: string; market?: string }) => p?.status === "active" && p?.market === "main")
      .map((p: Record<string, unknown>) => {
        const coinType = normalizeCoinType(String(p.coinType ?? p.suiCoinType ?? ""));
        const supplyApy = parseApyValue(p.supplyIncentiveApyInfo);
        const borrowApy = parseApyValue(p.borrowIncentiveApyInfo);
        const token = (p.token ?? {}) as Record<string, unknown>;
        const contract = (p.contract ?? {}) as Record<string, unknown>;
        const symbol = String(token.symbol ?? "UNKNOWN");
        const oracleIdRaw = p.oracleId;
        const oracleId =
          typeof oracleIdRaw === "number" ? oracleIdRaw : parseInt(String(oracleIdRaw ?? ""), 10);
        return {
          assetId: typeof p.id === "number" ? p.id : parseInt(String(p.id), 10) || 0,
          oracleId: Number.isFinite(oracleId) ? oracleId : undefined,
          coinType,
          symbol,
          decimals:
            typeof token.decimals === "number" ? token.decimals : parseInt(String(token.decimals), 10) || 9,
          supplyApy,
          borrowApy,
          totalSupplyRaw: String(p.totalSupplyAmount ?? "0"),
          totalBorrowRaw: String(p.borrowedAmount ?? "0"),
          reserveId: String(contract.reserveId ?? ""),
          poolObjectId: String(contract.pool ?? ""),
          priceUsd: safeParseFloat(token.price),
          risk: riskLabelForSymbol(symbol),
        };
      })
      .filter((p: NaviPoolRow) => {
        if (!p.reserveId || !p.poolObjectId) return false;
        if (p.supplyApy <= 0) return false;
        return true;
      })
      .sort((a, b) => b.supplyApy - a.supplyApy);

    cachedPools = pools;
    lastPoolFetchTime = now;
    return pools;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const isCloudflareBlock = errorMsg.includes("HTTP 403") && errorMsg.includes("Just a moment");
    if (isCloudflareBlock) {
      const fallbackPools = await fetchNaviPoolsFromOnChain(env);
      if (fallbackPools.length > 0) {
        cachedPools = fallbackPools;
        lastPoolFetchTime = now;
        return fallbackPools;
      }
    }
    if (cachedPools) {
      return cachedPools;
    }
    return [];
  }
}

export function clearNaviPoolsCache(): void {
  cachedPools = null;
  lastPoolFetchTime = 0;
}

export async function resolvePoolByAssetSymbol(pools: NaviPoolRow[], asset: string): Promise<NaviPoolRow | null> {
  const u = asset.trim().toUpperCase();
  const exact = pools.find((p) => p.symbol.toUpperCase() === u);
  if (exact) return exact;
  const partial = pools.find((p) => p.symbol.toUpperCase().includes(u) || u.includes(p.symbol.toUpperCase()));
  return partial ?? null;
}

export async function ensureNaviProtocolReachable(): Promise<void> {
  await fetchNaviConfig(false);
}
