import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { SuiChainEnvironment } from "../../../../config/chains/sui";
import { getSuiClientForEnvironment } from "../../../../main/services/chains/sui/sui-client.service";
import { NAVI_POOL_CONFIGS, NAVI_RESERVE_PARENT_ID } from "./navi-onchain-pool-config";
import type { NaviPoolRow, NaviPositionView } from "./navi.types";
import { riskLabelForSymbol } from "./navi-risk.service";

function safeParseFloat(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  const parsed = parseFloat(String(val));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function readDynamicField(
  client: SuiJsonRpcClient,
  parentId: string,
  nameType: string,
  nameValue: string | number,
): Promise<unknown> {
  try {
    const result = await client.getDynamicFieldObject({
      parentId,
      name: { type: nameType, value: nameValue },
    });
    return result;
  } catch {
    return null;
  }
}

async function getSupplyIndex(client: SuiJsonRpcClient, assetId: number): Promise<number> {
  try {
    const result = (await readDynamicField(client, NAVI_RESERVE_PARENT_ID, "u8", assetId)) as {
      data?: { content?: { fields?: { value?: { fields?: Record<string, unknown> } } } };
    } | null;
    const fields = result?.data?.content?.fields?.value?.fields;
    if (!fields) return 1;
    const rawIndex = fields.current_supply_index;
    if (!rawIndex) return 1;
    const indexNum = safeParseFloat(rawIndex);
    if (indexNum <= 0) return 1;
    const index = indexNum / 1e27;
    return index > 0 ? index : 1;
  } catch {
    return 1;
  }
}

function safeComputeSupplyBalance(rawValue: string, supplyIndex: number): number {
  const cleanValue = String(rawValue).trim();
  if (!cleanValue || cleanValue === "0") return 0;

  try {
    const rawBigInt = BigInt(cleanValue);
    const indexScaledNum = Math.round(supplyIndex * 1e9);
    if (!Number.isFinite(indexScaledNum) || indexScaledNum <= 0) {
      return Number(rawBigInt) / 1e9;
    }
    const indexScaled = BigInt(indexScaledNum);
    const product = rawBigInt * indexScaled;
    const DIVISOR = BigInt(1_000_000_000) * BigInt(1_000_000_000);
    const wholePart = product / DIVISOR;
    const remainder = product % DIVISOR;
    const result = Number(wholePart) + Number(remainder) / Number(DIVISOR);
    return Number.isFinite(result) ? result : 0;
  } catch {
    const rawShareValue = Number(cleanValue);
    if (!Number.isFinite(rawShareValue) || Number.isNaN(rawShareValue)) return 0;
    return (rawShareValue * supplyIndex) / 1e9;
  }
}

function formatHumanTokenAmount(n: number, decimals: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  const d = Math.min(Math.max(decimals, 0), 12);
  const s = n.toFixed(d);
  const trimmed = s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return trimmed.length ? trimmed : "0";
}

export async function fetchNaviPositionsOnChain(
  walletAddress: string,
  env: SuiChainEnvironment,
): Promise<
  Array<{
    symbol: string;
    assetId: number;
    coinType: string;
    decimals: number;
    supplyBalanceHuman: number;
    supplyBalanceRaw: string;
  }>
> {
  if (env !== "mainnet") {
    return [];
  }
  const client = getSuiClientForEnvironment(env);
  const BATCH_SIZE = 8;
  const poolsWithBalance: Array<{ poolCfg: (typeof NAVI_POOL_CONFIGS)[0]; rawValue: string }> = [];

  for (let i = 0; i < NAVI_POOL_CONFIGS.length; i += BATCH_SIZE) {
    const batch = NAVI_POOL_CONFIGS.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (poolCfg) => {
        const result = (await readDynamicField(
          client,
          poolCfg.supplyBalanceParentId,
          "address",
          walletAddress,
        )) as { data?: { content?: { fields?: { value?: unknown } } } } | null;
        const rawValue = result?.data?.content?.fields?.value;
        if (!rawValue || String(rawValue) === "0") return null;
        return { poolCfg, rawValue: String(rawValue) };
      }),
    );
    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value) {
        poolsWithBalance.push(r.value);
      }
    }
  }

  if (poolsWithBalance.length === 0) {
    return [];
  }

  const indexResults = await Promise.allSettled(
    poolsWithBalance.map(({ poolCfg }) => getSupplyIndex(client, poolCfg.assetId)),
  );

  const out: Array<{
    symbol: string;
    assetId: number;
    coinType: string;
    decimals: number;
    supplyBalanceHuman: number;
    supplyBalanceRaw: string;
  }> = [];

  for (let i = 0; i < poolsWithBalance.length; i++) {
    const { poolCfg, rawValue } = poolsWithBalance[i];
    const indexResult = indexResults[i];
    const supplyIndex = indexResult.status === "fulfilled" ? indexResult.value : 1;
    const actualBalance = safeComputeSupplyBalance(rawValue, supplyIndex);
    if (actualBalance > 0) {
      out.push({
        symbol: poolCfg.symbol,
        assetId: poolCfg.assetId,
        coinType: poolCfg.coinType,
        decimals: poolCfg.decimals,
        supplyBalanceHuman: actualBalance,
        supplyBalanceRaw: rawValue,
      });
    }
  }

  return out;
}

export async function buildNaviPositionViews(
  walletAddress: string,
  env: SuiChainEnvironment,
  pools: NaviPoolRow[],
): Promise<NaviPositionView[]> {
  const onChain = await fetchNaviPositionsOnChain(walletAddress, env);
  const poolByAssetId = new Map(pools.map((p) => [p.assetId, p]));

  return onChain.map((o) => {
    const pool = poolByAssetId.get(o.assetId);
    const apy = pool?.supplyApy ?? 0;
    const poolObjectId = pool?.poolObjectId ?? "";
    const suppliedFormatted = formatHumanTokenAmount(o.supplyBalanceHuman, o.decimals);
    return {
      protocol: "Navi",
      assetSymbol: o.symbol,
      coinType: o.coinType,
      suppliedRaw: o.supplyBalanceRaw,
      suppliedFormatted,
      currentValueRaw: o.supplyBalanceRaw,
      currentValueFormatted: suppliedFormatted,
      apy,
      poolObjectId,
      risk: riskLabelForSymbol(o.symbol),
    };
  });
}
