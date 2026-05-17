import { BROWSER_HISTORY_LIMIT } from "../constants";
import type { BrowserHistoryItem } from "../types/browser.types";
import { browserHistoryDomain, browserHistoryTitle, isNavigableWebUrl } from "./browserNavigation";

export function appendBrowserHistoryItem(
  history: BrowserHistoryItem[],
  url: string,
  title?: string,
): BrowserHistoryItem[] {
  if (!isNavigableWebUrl(url)) return history;
  const domain = browserHistoryDomain(url);
  const nextTitle = browserHistoryTitle(url, title);
  const withoutDup = history.filter((item) => item.url !== url);
  const entry: BrowserHistoryItem = {
    id: crypto.randomUUID(),
    url,
    title: nextTitle,
    domain,
    timestamp: Date.now(),
  };
  return [entry, ...withoutDup].slice(0, BROWSER_HISTORY_LIMIT);
}
