import type { BrowserFavorite } from "../types/browser.types";

export function isFavoriteUrl(favorites: BrowserFavorite[], url: string): boolean {
  return favorites.some((f) => f.url === url);
}

export function isFavoriteDappId(favorites: BrowserFavorite[], dappId: string): boolean {
  return favorites.some((f) => f.dappId === dappId);
}

export function toggleBrowserFavorite(
  favorites: BrowserFavorite[],
  entry: { url: string; title: string; dappId?: string; pinned?: boolean },
): BrowserFavorite[] {
  const existing = entry.dappId
    ? favorites.find((f) => f.dappId === entry.dappId)
    : favorites.find((f) => f.url === entry.url);
  if (existing) {
    return favorites.filter((f) => f.id !== existing.id);
  }
  return [
    {
      id: crypto.randomUUID(),
      dappId: entry.dappId,
      url: entry.url,
      title: entry.title,
      pinned: entry.pinned ?? false,
      addedAt: Date.now(),
    },
    ...favorites,
  ];
}

export function toggleBrowserFavoritePin(
  favorites: BrowserFavorite[],
  favoriteId: string,
): BrowserFavorite[] {
  return favorites.map((f) => (f.id === favoriteId ? { ...f, pinned: !f.pinned } : f));
}
