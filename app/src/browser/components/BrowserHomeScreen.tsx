import { Clock, Compass, Sparkles } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { ChainId } from "../../shared/wallet/types";
import {
  getBrowserDappById,
  getBrowserDappsForChain,
  groupDappsIntoSections,
  type BrowserDappDefinition,
} from "../../config/browser/chains";
import type { BrowserFavorite, BrowserHistoryItem } from "../types/browser.types";
import { isFavoriteDappId, isFavoriteUrl } from "../utils/browserFavorites";
import { BrowserDappCard } from "./BrowserDappCard";
import { BrowserDappIcon } from "./BrowserDappIcon";
import { AppLogo } from "@/components/branding/AppLogo";

type HomePanel = "discover" | "recent";

export type BrowserHomeScreenProps = {
  chainId: ChainId;
  chainLabel: string;
  history: BrowserHistoryItem[];
  favorites: BrowserFavorite[];
  connectedOrigins: string[];
  onOpenUrl: (url: string, title?: string) => void;
  onToggleFavorite: (entry: { url: string; title: string; dappId?: string }) => void;
  onTogglePin: (favoriteId: string) => void;
};

function resolveFavoriteDapp(chainId: ChainId, favorite: BrowserFavorite): BrowserDappDefinition | null {
  if (favorite.dappId) {
    return getBrowserDappById(chainId, favorite.dappId) ?? null;
  }
  return null;
}

function dedupeHistory(items: BrowserHistoryItem[]): BrowserHistoryItem[] {
  const seen = new Set<string>();
  const result: BrowserHistoryItem[] = [];
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    result.push(item);
  }
  return result;
}

export function BrowserHomeScreen({
  chainId,
  chainLabel,
  history,
  favorites,
  connectedOrigins,
  onOpenUrl,
  onToggleFavorite,
  onTogglePin,
}: BrowserHomeScreenProps) {
  const [panel, setPanel] = useState<HomePanel>("discover");

  const catalog = useMemo(() => getBrowserDappsForChain(chainId), [chainId]);
  const sections = useMemo(() => groupDappsIntoSections(catalog), [catalog]);

  const pinnedFavorites = useMemo(
    () => favorites.filter((f) => f.pinned),
    [favorites],
  );

  const pinnedDapps = useMemo(() => {
    const items: BrowserDappDefinition[] = [];
    for (const favorite of pinnedFavorites) {
      const fromCatalog = resolveFavoriteDapp(chainId, favorite);
      if (fromCatalog) {
        items.push(fromCatalog);
        continue;
      }
      items.push({
        id: favorite.id,
        name: favorite.title,
        description: favorite.url.replace(/^https?:\/\//, ""),
        url: favorite.url,
        category: "tools",
      });
    }
    return items;
  }, [chainId, pinnedFavorites]);

  const recentItems = useMemo(() => dedupeHistory(history).slice(0, 20), [history]);

  const connectedDapps = useMemo(() => {
    if (!connectedOrigins.length) return [];
    return catalog.filter((dapp) => {
      try {
        const origin = new URL(dapp.url).origin;
        return connectedOrigins.includes(origin);
      } catch {
        return false;
      }
    });
  }, [catalog, connectedOrigins]);

  const hasCatalog = catalog.length > 0;

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col overflow-hidden bg-background"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="shrink-0 border-b border-border/80 bg-background/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="mb-3">
          <div className="mb-2 flex items-center gap-2">
            <AppLogo variant="mark" size="xs" />
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {chainLabel}
            </p>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Discover Apps</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tap a dapp to open it in Destrall with your wallet connected.
          </p>
        </div>

        <div className="flex gap-1 rounded-xl border border-border bg-secondary/30 p-1">
          <HomeTabButton
            active={panel === "discover"}
            icon={<Compass className="h-3.5 w-3.5" />}
            label="Discover"
            onClick={() => setPanel("discover")}
          />
          <HomeTabButton
            active={panel === "recent"}
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Recent"
            badge={recentItems.length > 0 ? recentItems.length : undefined}
            onClick={() => setPanel("recent")}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {panel === "recent" ? (
          <RecentPanel items={recentItems} onOpenUrl={onOpenUrl} />
        ) : (
          <DiscoverPanel
            chainLabel={chainLabel}
            hasCatalog={hasCatalog}
            pinnedDapps={pinnedDapps}
            connectedDapps={connectedDapps}
            sections={sections}
            favorites={favorites}
            onOpenUrl={onOpenUrl}
            onToggleFavorite={onToggleFavorite}
            onTogglePin={onTogglePin}
          />
        )}
      </div>
    </div>
  );
}

function HomeTabButton({
  active,
  icon,
  label,
  badge,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
      {badge !== undefined ? (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] ${
            active ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
          }`}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function RecentPanel({
  items,
  onOpenUrl,
}: {
  items: BrowserHistoryItem[];
  onOpenUrl: (url: string, title?: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
        <Clock className="mb-3 h-8 w-8 text-muted-foreground/60" />
        <p className="text-sm font-medium text-foreground">No recent visits yet</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Sites you open in the browser will appear here.
        </p>
      </div>
    );
  }

  return (
    <section>
      <SectionHeading icon={<Clock className="h-3.5 w-3.5" />} title="Recently visited" />
      <div className="space-y-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpenUrl(item.url, item.title)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-secondary/50"
          >
            <BrowserDappIcon name={item.title || item.domain} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {item.title || item.domain}
              </p>
              <p className="truncate text-xs text-muted-foreground">{item.domain}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function DiscoverPanel({
  chainLabel,
  hasCatalog,
  pinnedDapps,
  connectedDapps,
  sections,
  favorites,
  onOpenUrl,
  onToggleFavorite,
  onTogglePin,
}: {
  chainLabel: string;
  hasCatalog: boolean;
  pinnedDapps: BrowserDappDefinition[];
  connectedDapps: BrowserDappDefinition[];
  sections: ReturnType<typeof groupDappsIntoSections>;
  favorites: BrowserFavorite[];
  onOpenUrl: (url: string, title?: string) => void;
  onToggleFavorite: (entry: { url: string; title: string; dappId?: string }) => void;
  onTogglePin: (favoriteId: string) => void;
}) {
  return (
    <>
      {!hasCatalog ? (
        <div className="mb-6 rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
          Browser home for {chainLabel} is coming soon.
        </div>
      ) : null}

      {pinnedDapps.length > 0 ? (
        <section className="mb-6">
          <SectionHeading icon={<Sparkles className="h-3.5 w-3.5" />} title="Pinned" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pinnedDapps.map((dapp) => {
              const favorite = favorites.find((f) => f.dappId === dapp.id || f.url === dapp.url);
              return (
                <BrowserDappCard
                  key={`pinned-${dapp.id}`}
                  dapp={dapp}
                  compact
                  isFavorite={Boolean(favorite)}
                  isPinned={favorite?.pinned}
                  onOpen={() => onOpenUrl(dapp.url, dapp.name)}
                  onToggleFavorite={() =>
                    onToggleFavorite({ url: dapp.url, title: dapp.name, dappId: dapp.id })
                  }
                  onTogglePin={favorite ? () => onTogglePin(favorite.id) : undefined}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {connectedDapps.length > 0 ? (
        <section className="mb-6">
          <SectionHeading title="Recently connected" />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {connectedDapps.map((dapp) => (
              <button
                key={`connected-${dapp.id}`}
                type="button"
                onClick={() => onOpenUrl(dapp.url, dapp.name)}
                className="flex min-w-[120px] shrink-0 flex-col items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-3 text-center transition hover:border-primary/30 hover:bg-card"
              >
                <BrowserDappIcon name={dapp.name} iconUrl={dapp.iconUrl} size="sm" />
                <span className="truncate text-xs font-medium">{dapp.name}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {sections.map((section) => (
        <section key={section.category} className="mb-6 last:mb-2">
          <SectionHeading title={section.title} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {section.dapps.map((dapp) => {
              const favorite = favorites.find((f) => f.dappId === dapp.id || f.url === dapp.url);
              return (
                <BrowserDappCard
                  key={dapp.id}
                  dapp={dapp}
                  isFavorite={
                    isFavoriteDappId(favorites, dapp.id) || isFavoriteUrl(favorites, dapp.url)
                  }
                  isPinned={favorite?.pinned}
                  onOpen={() => onOpenUrl(dapp.url, dapp.name)}
                  onToggleFavorite={() =>
                    onToggleFavorite({ url: dapp.url, title: dapp.name, dappId: dapp.id })
                  }
                  onTogglePin={favorite ? () => onTogglePin(favorite.id) : undefined}
                />
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

function SectionHeading({
  title,
  icon,
}: {
  title: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}
