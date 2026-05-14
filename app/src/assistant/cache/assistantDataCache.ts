import type { SuiChainEnvironment } from "../../config/chains/sui";
import type { ChainActivityItem, TokenBalanceView } from "../../types/blockchain";
import { chainFacadeService } from "../../main/services/chains/chainFacadeService";
import { fetchNaviPools } from "../../packages/core/yield/navi/navi-pools.service";
import { buildNaviPositionViews } from "../../packages/core/yield/navi/navi-positions.service";
import type { NaviPoolRow, NaviPositionView } from "../../packages/core/yield/navi/navi.types";
import { walletService } from "../../main/wallet/walletService";

type Entry<T> = { value: T; fetchedAt: number };

const BALANCE_TTL_MS = 45_000;
const BALANCE_STALE_MS = 90_000;

const ACTIVITY_TTL_MS = 45_000;
const ACTIVITY_STALE_MS = 90_000;

const POOLS_TTL_MS = 5 * 60_000;
const POOLS_STALE_MS = 6 * 60_000;

const POSITIONS_TTL_MS = 60_000;
const POSITIONS_STALE_MS = 120_000;

const balanceByAccount = new Map<string, Entry<TokenBalanceView[]>>();
const activityByAccount = new Map<string, Entry<ChainActivityItem[]>>();
const poolsByEnv = new Map<string, Entry<NaviPoolRow[]>>();
const positionsByKey = new Map<string, Entry<NaviPositionView[]>>();

async function swrGet<T>(
  map: Map<string, Entry<T>>,
  key: string,
  ttlMs: number,
  staleMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = map.get(key);
  if (hit && now - hit.fetchedAt < ttlMs) {
    return hit.value;
  }
  if (hit && now - hit.fetchedAt < staleMs) {
    void (async () => {
      try {
        const value = await fetcher();
        map.set(key, { value, fetchedAt: Date.now() });
      } catch {
        /* keep stale */
      }
    })();
    return hit.value;
  }
  const value = await fetcher();
  map.set(key, { value, fetchedAt: Date.now() });
  return value;
}

/**
 * TTL + stale-while-revalidate caches for assistant reads (main process).
 * Avoids refetching balances, pools, positions, and activity on every chat turn.
 *
 * Renderer may additionally warm data with TanStack Query; this store is the
 * authoritative fast path for main-process assistant planning and LLM context.
 */
export const assistantDataCache = {
  async getTokenBalances(accountId: string): Promise<TokenBalanceView[]> {
    return swrGet(balanceByAccount, accountId, BALANCE_TTL_MS, BALANCE_STALE_MS, () =>
      chainFacadeService.getTokenBalances(accountId),
    );
  },

  async getActivityPreview(accountId: string, limit = 12): Promise<ChainActivityItem[]> {
    return swrGet(activityByAccount, accountId, ACTIVITY_TTL_MS, ACTIVITY_STALE_MS, async () => {
      const page = await chainFacadeService.getActivityPage(accountId);
      return page.items.slice(0, limit);
    });
  },

  async getNaviPools(env: SuiChainEnvironment): Promise<NaviPoolRow[]> {
    return swrGet(poolsByEnv, env, POOLS_TTL_MS, POOLS_STALE_MS, () => fetchNaviPools(env, false));
  },

  async getNaviPositionViews(accountId: string, env: SuiChainEnvironment): Promise<NaviPositionView[]> {
    const account = walletService.getWalletAccount(accountId);
    if (!account || account.chain !== "sui" || env !== "mainnet") {
      return [];
    }
    const key = `${accountId}:${env}`;
    return swrGet(positionsByKey, key, POSITIONS_TTL_MS, POSITIONS_STALE_MS, async () => {
      const pools = await assistantDataCache.getNaviPools(env);
      return buildNaviPositionViews(account.address, env, pools);
    });
  },
};
