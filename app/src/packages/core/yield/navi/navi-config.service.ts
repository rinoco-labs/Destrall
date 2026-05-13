import type { NaviConfig, NaviOracleFeedRef } from "./navi.types";

const NAVI_CONFIG_API = "https://open-api.naviprotocol.io/api/navi/config";
const NAVI_PACKAGE_API = "https://open-api.naviprotocol.io/api/package";
const NAVI_POOLS_API = "https://open-api.naviprotocol.io/api/navi/pools";
const NAVI_CONFIG_FALLBACK_API = "https://open-api.naviprotocol.io/api/navi/contract/configs";
const FETCH_TIMEOUT_MS = 15_000;

const FALLBACK_CONFIG: NaviConfig = {
  protocolPackage: "0xee0041239b89564ce870a7dec5ddc5d114367ab94a1137e90aa0633cb76518e0",
  storageId: "0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe",
  incentiveV2: "0xf87a8acb8b81d14307894d12595541a73f19933f88e1326d5be349c7a6f7559c",
  incentiveV3: "0x62982dad27fb10bb314b3384d5de8d2ac2d72ab2dbeae5d801dbdb9efa816c80",
  priceOracle: "0x1568865ed9a0b5ec414220e8f79b3d04c77acc82358f6e5ae4635687392ffbef",
  reserveParentId: "0xe6d4c6610b86ce7735ea754596d71d72d10c7980b5052fc3c8cdf8d09fea9b4b",
};

let cachedConfig: NaviConfig | null = null;
let cachedConfigTime = 0;
const CONFIG_CACHE_TTL = 300_000;

async function safeFetchJson(url: string, options?: RequestInit, retryCount = 0): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const method = (options?.method ?? "GET").toUpperCase();
    const isBodyMethod = method === "POST" || method === "PUT" || method === "PATCH";
    const isNaviApi = url.includes("open-api.naviprotocol.io");
    const defaultHeaders: Record<string, string> = {
      Accept: "application/json",
    };
    if (isBodyMethod) {
      defaultHeaders["Content-Type"] = "application/json";
    }
    if (isNaviApi) {
      defaultHeaders["User-Agent"] =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
      defaultHeaders["Referer"] = "https://app.naviprotocol.io/";
    }

    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: Object.assign(defaultHeaders, options?.headers ?? {}),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }
    const rawText = await res.text();
    if (!rawText || rawText.trim().length === 0) throw new Error("Empty response body");
    return JSON.parse(rawText) as unknown;
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    const isNetwork =
      err instanceof Error &&
      (err.message.includes("Network") || err.message.includes("Failed to fetch") || err.message.includes("network"));
    if ((isTimeout || isNetwork) && retryCount < 2) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
      return safeFetchJson(url, options, retryCount + 1);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchLatestPackageId(): Promise<string | null> {
  try {
    const data = (await safeFetchJson(NAVI_PACKAGE_API)) as { packageId?: string };
    return data?.packageId ?? null;
  } catch {
    return null;
  }
}

export async function fetchNaviConfig(forceRefresh = false): Promise<NaviConfig> {
  const now = Date.now();
  if (!forceRefresh && cachedConfig && now - cachedConfigTime < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }

  const [configResult, latestPkgId] = await Promise.all([
    safeFetchJson(NAVI_CONFIG_API)
      .then((json) => (json as { data?: Record<string, unknown> })?.data)
      .catch(() =>
        safeFetchJson(NAVI_CONFIG_FALLBACK_API)
          .then((json): Record<string, unknown> | null => {
            const arr = (json as { data?: unknown[] })?.data;
            return Array.isArray(arr) && arr.length > 0 ? (arr[0] as Record<string, unknown>) : null;
          })
          .catch((): null => null),
      ),
    fetchLatestPackageId(),
  ]);

  if (configResult?.package || configResult?.storage) {
    const cr = configResult as Record<string, unknown>;
    const protocolPackage = (latestPkgId || (typeof cr.package === "string" ? cr.package : null) ||
      FALLBACK_CONFIG.protocolPackage) as string;
    const base: NaviConfig = {
      protocolPackage,
      storageId: (typeof cr.storage === "string" ? cr.storage : FALLBACK_CONFIG.storageId) as string,
      incentiveV2: (typeof cr.incentiveV2 === "string" ? cr.incentiveV2 : FALLBACK_CONFIG.incentiveV2) as string,
      incentiveV3: (typeof cr.incentiveV3 === "string" ? cr.incentiveV3 : FALLBACK_CONFIG.incentiveV3) as string,
      priceOracle: (typeof cr.priceOracle === "string" ? cr.priceOracle : FALLBACK_CONFIG.priceOracle) as string,
      reserveParentId: (typeof cr.reserveParentId === "string" ? cr.reserveParentId : FALLBACK_CONFIG.reserveParentId) as string,
    };

    const oracleBlock = (configResult as { oracle?: Record<string, unknown> }).oracle;
    if (
      oracleBlock &&
      typeof oracleBlock.packageId === "string" &&
      typeof oracleBlock.oracleConfig === "string" &&
      typeof oracleBlock.supraOracleHolder === "string" &&
      Array.isArray(oracleBlock.feeds)
    ) {
      const feeds: NaviOracleFeedRef[] = [];
      for (const row of oracleBlock.feeds) {
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        const coinType = typeof r.coinType === "string" ? r.coinType : "";
        const feedId = typeof r.feedId === "string" ? r.feedId : "";
        const pythPriceInfoObject = typeof r.pythPriceInfoObject === "string" ? r.pythPriceInfoObject : "";
        if (!coinType || !feedId || !pythPriceInfoObject) continue;
        feeds.push({
          oracleId: typeof r.oracleId === "number" ? r.oracleId : parseInt(String(r.oracleId), 10) || 0,
          assetId: typeof r.assetId === "number" ? r.assetId : parseInt(String(r.assetId), 10) || 0,
          coinType,
          feedId,
          pythPriceInfoObject,
        });
      }
      base.oraclePackageId = oracleBlock.packageId;
      base.oracleConfigObjectId = oracleBlock.oracleConfig;
      base.supraOracleHolderId = oracleBlock.supraOracleHolder;
      if (typeof oracleBlock.switchboardAggregator === "string") {
        base.switchboardAggregatorId = oracleBlock.switchboardAggregator;
      }
      base.oracleFeeds = feeds;
    }

    cachedConfig = base;
  } else {
    const protocolPackage = latestPkgId || FALLBACK_CONFIG.protocolPackage;
    cachedConfig = { ...FALLBACK_CONFIG, protocolPackage };
  }

  cachedConfigTime = now;
  return cachedConfig;
}

export function clearNaviConfigCache(): void {
  cachedConfig = null;
  cachedConfigTime = 0;
}

export { NAVI_POOLS_API, safeFetchJson };
