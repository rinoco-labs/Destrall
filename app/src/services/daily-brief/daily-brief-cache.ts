import type { DailyBrief } from "./daily-brief-types";

type Entry = { brief: DailyBrief; fetchedAt: number };

/** Fresh window — return cache without refetch. */
const FRESH_MS = 20 * 60 * 1000;
/** Stale-while-revalidate — return cache and refresh in background. */
const STALE_MS = 35 * 60 * 1000;

const store = new Map<string, Entry>();

export const dailyBriefCache = {
  async getOrRevalidate(key: string, factory: () => Promise<DailyBrief>): Promise<DailyBrief> {
    const now = Date.now();
    const hit = store.get(key);
    if (hit && now - hit.fetchedAt < FRESH_MS) {
      return hit.brief;
    }
    if (hit && now - hit.fetchedAt < STALE_MS) {
      void (async () => {
        try {
          const brief = await factory();
          store.set(key, { brief, fetchedAt: Date.now() });
        } catch {
          /* keep stale */
        }
      })();
      return hit.brief;
    }
    const brief = await factory();
    store.set(key, { brief, fetchedAt: Date.now() });
    return brief;
  },
};
