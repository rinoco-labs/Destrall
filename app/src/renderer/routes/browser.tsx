import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { BrowserHeader } from "../../browser/components/BrowserHeader";
import { BrowserTabs, type BrowserTabItem } from "../../browser/components/BrowserTabs";
import { BrowserWebView } from "../../browser/components/BrowserWebView";
import { DappApprovalModal } from "../../browser/components/DappApprovalModal";
import { useBrowserWalletBridge } from "../../browser/hooks/useBrowserWalletBridge";
import type { BrowserPersistedState, BrowserTab } from "../../browser/types/browser.types";
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
} from "@/lib/desktopBrowser";
import { useWalletStore } from "@/stores/walletStore";

const DEFAULT_URL = "https://sui.io";

function normalizeUrlInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_URL;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
}

function newTab(url = DEFAULT_URL): BrowserTabItem {
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
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);

  const [tabs, setTabs] = useState<BrowserTabItem[]>(() => [newTab()]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0]?.id ?? "");
  const [urlInput, setUrlInput] = useState(DEFAULT_URL);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [persistedMeta, setPersistedMeta] = useState<Pick<BrowserPersistedState, "history" | "connectedDapps">>({
    history: [],
    connectedDapps: [],
  });

  const { pending, busy, activeAccount, networkLabel, approvePending, rejectPending } =
    useBrowserWalletBridge();

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

  const persistTabs = useCallback(
    (nextTabs: BrowserTabItem[], nextActiveId: string) => {
      if (!activeAccountId || !hydratedRef.current) return;
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        const state: BrowserPersistedState = {
          tabs: nextTabs.map(toPersistedTab),
          activeTabId: nextActiveId,
          history: persistedMeta.history,
          connectedDapps: persistedMeta.connectedDapps,
        };
        void desktopBrowserReplaceState(activeAccountId, state).catch(() => undefined);
      }, 400);
    },
    [activeAccountId, persistedMeta.connectedDapps, persistedMeta.history],
  );

  const updateActiveTabUrl = useCallback(
    (url: string, title?: string) => {
      setTabs((prev) => {
        const next = prev.map((tab) =>
          tab.id === activeTabId ? { ...tab, url, title: title ?? tab.title } : tab,
        );
        persistTabs(next, activeTabId);
        return next;
      });
    },
    [activeTabId, persistTabs],
  );

  useLayoutEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await desktopNativeBrowserSetVisible(true);
        if (!cancelled) scheduleSyncBounds();
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Browser is unavailable");
        }
      }
    })();

    const ro = new ResizeObserver(() => scheduleSyncBounds());
    if (viewportRef.current) ro.observe(viewportRef.current);
    if (chromeRef.current) ro.observe(chromeRef.current);
    window.addEventListener("resize", scheduleSyncBounds);

    return () => {
      cancelled = true;
      ro.disconnect();
      window.removeEventListener("resize", scheduleSyncBounds);
      void desktopNativeBrowserSetVisible(false).catch(() => undefined);
    };
  }, [scheduleSyncBounds]);

  useEffect(() => {
    if (!activeAccountId) return;
    hydratedRef.current = false;
    void desktopBrowserGetState(activeAccountId)
      .then((state) => {
        setPersistedMeta({
          history: state.history,
          connectedDapps: state.connectedDapps,
        });
        const restored =
          state.tabs.length > 0
            ? state.tabs.map((tab) => ({ id: tab.id, url: tab.url, title: tab.title }))
            : [newTab()];
        const activeId =
          state.activeTabId && restored.some((tab) => tab.id === state.activeTabId)
            ? state.activeTabId
            : restored[0].id;
        const activeTab = restored.find((tab) => tab.id === activeId) ?? restored[0];
        setTabs(restored);
        setActiveTabId(activeId);
        setUrlInput(activeTab.url);
        return desktopNativeBrowserNavigate(normalizeUrlInput(activeTab.url));
      })
      .catch(() => {
        const fallback = newTab();
        setTabs([fallback]);
        setActiveTabId(fallback.id);
        setUrlInput(fallback.url);
        return desktopNativeBrowserNavigate(fallback.url);
      })
      .finally(() => {
        hydratedRef.current = true;
        scheduleSyncBounds();
      });
  }, [activeAccountId, scheduleSyncBounds]);

  useEffect(() => {
    const unsubNav = subscribeNativeBrowserDidNavigate((url) => {
      setUrlInput(url);
      setLoadError(null);
      updateActiveTabUrl(url);
      scheduleSyncBounds();
    });
    const unsubLoad = subscribeNativeBrowserLoading(setIsLoading);
    return () => {
      unsubNav();
      unsubLoad();
    };
  }, [scheduleSyncBounds, updateActiveTabUrl]);

  const navigateToInput = useCallback(async () => {
    const next = normalizeUrlInput(urlInput);
    setLoadError(null);
    setUrlInput(next);
    updateActiveTabUrl(next);
    try {
      await desktopNativeBrowserNavigate(next);
      scheduleSyncBounds();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Navigation failed");
    }
  }, [scheduleSyncBounds, updateActiveTabUrl, urlInput]);

  const selectTab = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((item) => item.id === tabId);
      if (!tab || tabId === activeTabId) return;
      setActiveTabId(tabId);
      setUrlInput(tab.url);
      setLoadError(null);
      persistTabs(tabs, tabId);
      try {
        await desktopNativeBrowserNavigate(normalizeUrlInput(tab.url));
        scheduleSyncBounds();
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Navigation failed");
      }
    },
    [activeTabId, persistTabs, scheduleSyncBounds, tabs],
  );

  const addTab = useCallback(() => {
    const tab = newTab();
    const nextTabs = [...tabs, tab];
    setTabs(nextTabs);
    setActiveTabId(tab.id);
    setUrlInput(tab.url);
    persistTabs(nextTabs, tab.id);
    void desktopNativeBrowserNavigate(tab.url).then(() => scheduleSyncBounds());
  }, [persistTabs, scheduleSyncBounds, tabs]);

  const closeTab = useCallback(
    (tabId: string) => {
      if (tabs.length <= 1) return;
      const index = tabs.findIndex((tab) => tab.id === tabId);
      if (index < 0) return;
      const nextTabs = tabs.filter((tab) => tab.id !== tabId);
      const fallback = nextTabs[Math.min(index, nextTabs.length - 1)];
      setTabs(nextTabs);
      setActiveTabId(fallback.id);
      setUrlInput(fallback.url);
      persistTabs(nextTabs, fallback.id);
      if (tabId === activeTabId) {
        void desktopNativeBrowserNavigate(fallback.url).then(() => scheduleSyncBounds());
      }
    },
    [activeTabId, persistTabs, scheduleSyncBounds, tabs],
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
          onUrlInputChange={setUrlInput}
          onSubmitUrl={() => void navigateToInput()}
          onBack={() => void desktopNativeBrowserGoBack()}
          onForward={() => void desktopNativeBrowserGoForward()}
          onReload={() => void desktopNativeBrowserReload()}
          onClearUrl={() => setUrlInput("")}
        />

        <div className="relative flex min-h-0 flex-1 flex-col">
          <BrowserWebView viewportRef={viewportRef} />
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
          accountId={activeAccount?.id}
          accountLabel={activeAccount?.name ?? "Active account"}
          accountAddress={activeAccount?.address ?? "—"}
          networkLabel={networkLabel}
          onApprove={() => void approvePending()}
          onReject={rejectPending}
          busy={busy}
        />
      ) : null}
    </AppShell>
  );
}
