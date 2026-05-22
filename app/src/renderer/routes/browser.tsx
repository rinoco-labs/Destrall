import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { BrowserHeader } from "../../browser/components/BrowserHeader";
import { BrowserHomeScreen } from "../../browser/components/BrowserHomeScreen";
import { BrowserTabs, type BrowserTabItem } from "../../browser/components/BrowserTabs";
import { BrowserWebView } from "../../browser/components/BrowserWebView";
import { DappApprovalModal } from "../../browser/components/DappApprovalModal";
import { BROWSER_HOME_URL, BROWSER_SEARCH_PLACEHOLDER } from "../../browser/constants";
import { useBrowserWalletBridge } from "../../browser/hooks/useBrowserWalletBridge";
import type { BrowserPersistedState, BrowserTab } from "../../browser/types/browser.types";
import {
  toggleBrowserFavorite,
  toggleBrowserFavoritePin,
} from "../../browser/utils/browserFavorites";
import { appendBrowserHistoryItem } from "../../browser/utils/browserHistory";
import {
  isBrowserHomeUrl,
  isNavigableWebUrl,
  normalizeBrowserUrlInput,
} from "../../browser/utils/browserNavigation";
import {
  desktopBrowserGetState,
  desktopBrowserReplaceState,
  desktopNativeBrowserGoBack,
  desktopNativeBrowserGoForward,
  desktopNativeBrowserNavigate,
  desktopNativeBrowserReload,
  desktopNativeBrowserSetVisible,
  desktopNativeBrowserSetViewportBounds,
  subscribeNativeBrowserDidNavigate,
  subscribeNativeBrowserLoading,
  subscribeNativeBrowserRequestBoundsSync,
} from "@/lib/desktopBrowser";
import { useNetworkStore } from "@/stores/networkStore";
import { useWalletStore } from "@/stores/walletStore";
import { getBrowserDappCatalog } from "../../config/browser/chains";
import type { ChainId } from "../../shared/wallet/types";

type BrowserPersistedMeta = Pick<
  BrowserPersistedState,
  "history" | "connectedDapps" | "favorites"
>;

function newTab(url = BROWSER_HOME_URL): BrowserTabItem {
  return {
    id: crypto.randomUUID(),
    url,
    title: "",
  };
}

function toPersistedTab(tab: BrowserTabItem): BrowserTab {
  return {
    id: tab.id,
    url: tab.url,
    title: tab.title,
    favicon: "",
    navHistory: [tab.url],
    navIndex: 0,
  };
}

function activeChainId(network: { activeChain: ChainId } | null, accountChain?: ChainId): ChainId {
  return network?.activeChain ?? accountChain ?? "sui";
}

export const Route = createFileRoute("/browser")({
  component: BrowserPage,
  head: () => ({
    meta: [
      { title: "Browser — Destrall" },
      { name: "description", content: "Browse Sui dapps with your Destrall wallet." },
    ],
  }),
});

function BrowserPage() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const activeAccountId = useWalletStore((s) => s.activeAccountId);
  const accounts = useWalletStore((s) => s.accounts);
  const network = useNetworkStore((s) => s.network);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);
  const persistedMetaRef = useRef<BrowserPersistedMeta>({
    history: [],
    connectedDapps: [],
    favorites: [],
  });

  const [tabs, setTabs] = useState<BrowserTabItem[]>(() => [newTab()]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0]?.id ?? "");
  const [urlInput, setUrlInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [persistedMeta, setPersistedMeta] = useState<BrowserPersistedMeta>({
    history: [],
    connectedDapps: [],
    favorites: [],
  });

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? accounts[0];
  const chainId = activeChainId(network, activeAccount?.chain);
  const chainLabel = getBrowserDappCatalog(chainId).label;

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0],
    [activeTabId, tabs],
  );
  const showHome = activeTab ? isBrowserHomeUrl(activeTab.url) : true;

  const { pending, busy, activeAccount: bridgeAccount, networkLabel, approvePending, rejectPending } =
    useBrowserWalletBridge();

  const connectedOrigins = useMemo(
    () => persistedMeta.connectedDapps.map((dapp) => dapp.origin),
    [persistedMeta.connectedDapps],
  );

  useEffect(() => {
    persistedMetaRef.current = persistedMeta;
  }, [persistedMeta]);

  const syncBounds = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    void desktopNativeBrowserSetViewportBounds({
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    }).catch(() => undefined);
  }, []);

  const scheduleSyncBounds = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => syncBounds());
    });
  }, [syncBounds]);

  useEffect(() => {
    if (!pending) scheduleSyncBounds();
  }, [pending, scheduleSyncBounds]);

  const persistBrowserState = useCallback(
    (nextTabs: BrowserTabItem[], nextActiveId: string, meta = persistedMetaRef.current) => {
      if (!activeAccountId || !hydratedRef.current) return;
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        const state: BrowserPersistedState = {
          tabs: nextTabs.map(toPersistedTab),
          activeTabId: nextActiveId,
          history: meta.history,
          connectedDapps: meta.connectedDapps,
          favorites: meta.favorites,
        };
        void desktopBrowserReplaceState(activeAccountId, state).catch(() => undefined);
      }, 400);
    },
    [activeAccountId],
  );

  const updateActiveTabUrl = useCallback(
    (url: string, title?: string) => {
      setTabs((prev) => {
        const next = prev.map((tab) =>
          tab.id === activeTabId ? { ...tab, url, title: title ?? tab.title } : tab,
        );
        persistBrowserState(next, activeTabId);
        return next;
      });
    },
    [activeTabId, persistBrowserState],
  );

  const navigateActiveTabTo = useCallback(
    async (rawUrl: string, title?: string) => {
      const next = normalizeBrowserUrlInput(rawUrl);
      setLoadError(null);
      setUrlInput(isBrowserHomeUrl(next) ? "" : next);
      updateActiveTabUrl(next, title);

      if (isBrowserHomeUrl(next)) {
        await desktopNativeBrowserSetVisible(false);
        return;
      }

      const nextMeta: BrowserPersistedMeta = {
        ...persistedMetaRef.current,
        history: appendBrowserHistoryItem(persistedMetaRef.current.history, next, title),
      };
      persistedMetaRef.current = nextMeta;
      setPersistedMeta(nextMeta);
      setTabs((prev) => {
        persistBrowserState(prev, activeTabId, nextMeta);
        return prev;
      });

      await desktopNativeBrowserSetVisible(true);
      try {
        await desktopNativeBrowserNavigate(next);
        scheduleSyncBounds();
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Navigation failed");
      }
    },
    [activeTabId, persistBrowserState, scheduleSyncBounds, updateActiveTabUrl],
  );

  useLayoutEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!cancelled) scheduleSyncBounds();
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Browser is unavailable");
        }
      }
    })();

    const observed = new Set<Element>();
    const ro = new ResizeObserver(() => scheduleSyncBounds());
    const observe = (el: Element | null | undefined) => {
      if (!el || observed.has(el)) return;
      observed.add(el);
      ro.observe(el);
    };

    observe(viewportRef.current);
    observe(chromeRef.current);
    observe(chromeRef.current?.parentElement);
    observe(document.querySelector("main > section"));

    const onWindowResize = () => scheduleSyncBounds();
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("destrall:browser-layout-change", onWindowResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", onWindowResize);
    }

    let unsubBoundsSync: (() => void) | undefined;
    try {
      unsubBoundsSync = subscribeNativeBrowserRequestBoundsSync(() => scheduleSyncBounds());
    } catch {
      // Preload not ready during hot reload
    }

    return () => {
      cancelled = true;
      ro.disconnect();
      observed.clear();
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("destrall:browser-layout-change", onWindowResize);
      window.visualViewport?.removeEventListener("resize", onWindowResize);
      unsubBoundsSync?.();
      void desktopNativeBrowserSetVisible(false).catch(() => undefined);
    };
  }, [scheduleSyncBounds]);

  useEffect(() => {
    if (!activeAccountId) return;
    hydratedRef.current = false;
    void desktopBrowserGetState(activeAccountId)
      .then((state) => {
        const meta: BrowserPersistedMeta = {
          history: state.history,
          connectedDapps: state.connectedDapps,
          favorites: state.favorites ?? [],
        };
        persistedMetaRef.current = meta;
        setPersistedMeta(meta);

        const restored =
          state.tabs.length > 0
            ? state.tabs.map((tab) => ({ id: tab.id, url: tab.url, title: tab.title }))
            : [newTab()];
        const activeId =
          state.activeTabId && restored.some((tab) => tab.id === state.activeTabId)
            ? state.activeTabId
            : restored[0].id;
        const active = restored.find((tab) => tab.id === activeId) ?? restored[0];
        setTabs(restored);
        setActiveTabId(activeId);
        setUrlInput(isBrowserHomeUrl(active.url) ? "" : active.url);

        if (isBrowserHomeUrl(active.url)) {
          return desktopNativeBrowserSetVisible(false);
        }
        return desktopNativeBrowserNavigate(normalizeBrowserUrlInput(active.url));
      })
      .catch(() => {
        const fallback = newTab();
        setTabs([fallback]);
        setActiveTabId(fallback.id);
        setUrlInput("");
        return desktopNativeBrowserSetVisible(false);
      })
      .finally(() => {
        hydratedRef.current = true;
        scheduleSyncBounds();
      });
  }, [activeAccountId, scheduleSyncBounds]);

  useEffect(() => {
    if (!hydratedRef.current || pending) return;
    if (showHome) {
      void desktopNativeBrowserSetVisible(false);
    } else {
      void desktopNativeBrowserSetVisible(true);
      scheduleSyncBounds();
    }
  }, [pending, scheduleSyncBounds, showHome]);

  useEffect(() => {
    const unsubNav = subscribeNativeBrowserDidNavigate((url) => {
      if (!isNavigableWebUrl(url)) return;
      setUrlInput(url);
      setLoadError(null);
      updateActiveTabUrl(url);

      const nextMeta: BrowserPersistedMeta = {
        ...persistedMetaRef.current,
        history: appendBrowserHistoryItem(persistedMetaRef.current.history, url),
      };
      persistedMetaRef.current = nextMeta;
      setPersistedMeta(nextMeta);
      setTabs((prev) => {
        persistBrowserState(prev, activeTabId, nextMeta);
        return prev;
      });
      scheduleSyncBounds();
    });
    const unsubLoad = subscribeNativeBrowserLoading(setIsLoading);
    return () => {
      unsubNav();
      unsubLoad();
    };
  }, [activeTabId, persistBrowserState, scheduleSyncBounds, updateActiveTabUrl]);

  const navigateToInput = useCallback(() => {
    void navigateActiveTabTo(urlInput);
  }, [navigateActiveTabTo, urlInput]);

  const selectTab = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((item) => item.id === tabId);
      if (!tab || tabId === activeTabId) return;
      setActiveTabId(tabId);
      setUrlInput(isBrowserHomeUrl(tab.url) ? "" : tab.url);
      setLoadError(null);
      persistBrowserState(tabs, tabId);

      if (isBrowserHomeUrl(tab.url)) {
        await desktopNativeBrowserSetVisible(false);
        return;
      }

      try {
        await desktopNativeBrowserSetVisible(true);
        await desktopNativeBrowserNavigate(normalizeBrowserUrlInput(tab.url));
        scheduleSyncBounds();
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Navigation failed");
      }
    },
    [activeTabId, persistBrowserState, scheduleSyncBounds, tabs],
  );

  const addTab = useCallback(() => {
    const tab = newTab();
    const nextTabs = [...tabs, tab];
    setTabs(nextTabs);
    setActiveTabId(tab.id);
    setUrlInput("");
    persistBrowserState(nextTabs, tab.id);
    void desktopNativeBrowserSetVisible(false);
  }, [persistBrowserState, tabs]);

  const closeTab = useCallback(
    (tabId: string) => {
      if (tabs.length <= 1) return;
      const index = tabs.findIndex((tab) => tab.id === tabId);
      if (index < 0) return;
      const nextTabs = tabs.filter((tab) => tab.id !== tabId);
      const fallback = nextTabs[Math.min(index, nextTabs.length - 1)];
      setTabs(nextTabs);
      setActiveTabId(fallback.id);
      setUrlInput(isBrowserHomeUrl(fallback.url) ? "" : fallback.url);
      persistBrowserState(nextTabs, fallback.id);
      if (tabId === activeTabId) {
        if (isBrowserHomeUrl(fallback.url)) {
          void desktopNativeBrowserSetVisible(false);
        } else {
          void desktopNativeBrowserNavigate(fallback.url).then(() => scheduleSyncBounds());
        }
      }
    },
    [activeTabId, persistBrowserState, scheduleSyncBounds, tabs],
  );

  const handleToggleFavorite = useCallback(
    (entry: { url: string; title: string; dappId?: string }) => {
      const nextFavorites = toggleBrowserFavorite(persistedMetaRef.current.favorites, entry);
      const nextMeta = { ...persistedMetaRef.current, favorites: nextFavorites };
      persistedMetaRef.current = nextMeta;
      setPersistedMeta(nextMeta);
      setTabs((prev) => {
        persistBrowserState(prev, activeTabId, nextMeta);
        return prev;
      });
    },
    [activeTabId, persistBrowserState],
  );

  const handleTogglePin = useCallback(
    (favoriteId: string) => {
      const nextFavorites = toggleBrowserFavoritePin(persistedMetaRef.current.favorites, favoriteId);
      const nextMeta = { ...persistedMetaRef.current, favorites: nextFavorites };
      persistedMetaRef.current = nextMeta;
      setPersistedMeta(nextMeta);
      setTabs((prev) => {
        persistBrowserState(prev, activeTabId, nextMeta);
        return prev;
      });
    },
    [activeTabId, persistBrowserState],
  );

  return (
    <AppShell active="browser" layout="browser">
      <div ref={chromeRef} className="flex h-full min-h-0 w-full flex-col">
        <BrowserTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onSelect={(tabId) => void selectTab(tabId)}
          onClose={closeTab}
          onAdd={addTab}
        />

        <BrowserHeader
          urlInput={urlInput}
          isLoading={isLoading}
          isHomeTab={showHome}
          searchPlaceholder={BROWSER_SEARCH_PLACEHOLDER}
          onUrlInputChange={setUrlInput}
          onSubmitUrl={navigateToInput}
          onBack={() => void desktopNativeBrowserGoBack()}
          onForward={() => void desktopNativeBrowserGoForward()}
          onReload={() => void desktopNativeBrowserReload()}
          onClearUrl={() => setUrlInput("")}
        />

        <div className="relative flex min-h-0 flex-1 flex-col">
          <BrowserWebView viewportRef={viewportRef} />
          {showHome && !pending ? (
            <BrowserHomeScreen
              chainId={chainId}
              chainLabel={chainLabel}
              history={persistedMeta.history}
              favorites={persistedMeta.favorites}
              connectedOrigins={connectedOrigins}
              onOpenUrl={(url, title) => void navigateActiveTabTo(url, title)}
              onToggleFavorite={handleToggleFavorite}
              onTogglePin={handleTogglePin}
            />
          ) : null}
          {loadError ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
              <p className="rounded-lg border border-destructive/30 bg-background/90 px-4 py-2 text-sm text-destructive">
                {loadError}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {pending ? (
        <DappApprovalModal
          request={pending}
          accountId={bridgeAccount?.id}
          accountLabel={bridgeAccount?.name ?? "Active account"}
          accountAddress={bridgeAccount?.address ?? "—"}
          networkLabel={networkLabel}
          onApprove={() => void approvePending()}
          onReject={rejectPending}
          busy={busy}
        />
      ) : null}
    </AppShell>
  );
}
