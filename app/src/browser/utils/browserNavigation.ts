import { BROWSER_HOME_URL } from "../constants";

export function isBrowserHomeUrl(url: string): boolean {
  return url.trim().toLowerCase() === BROWSER_HOME_URL;
}

export function normalizeBrowserUrlInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return BROWSER_HOME_URL;
  if (isBrowserHomeUrl(trimmed)) return BROWSER_HOME_URL;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
}

export function isNavigableWebUrl(url: string): boolean {
  if (isBrowserHomeUrl(url)) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return /^https?:\/\//i.test(url.trim());
  }
}

export function browserHistoryDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 64);
  }
}

export function browserHistoryTitle(url: string, title?: string): string {
  const trimmed = title?.trim();
  if (trimmed) return trimmed;
  return browserHistoryDomain(url);
}
