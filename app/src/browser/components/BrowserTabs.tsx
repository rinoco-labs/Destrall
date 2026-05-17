import { Plus, X } from "lucide-react";
import { isBrowserHomeUrl } from "../utils/browserNavigation";

export type BrowserTabItem = {
  id: string;
  url: string;
  title: string;
};

export type BrowserTabsProps = {
  tabs: BrowserTabItem[];
  activeTabId: string;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onAdd: () => void;
};

function tabLabel(tab: BrowserTabItem): string {
  if (isBrowserHomeUrl(tab.url)) return "New tab";
  if (tab.title.trim()) return tab.title;
  try {
    return new URL(tab.url).hostname.replace(/^www\./, "");
  } catch {
    return "New tab";
  }
}

export function BrowserTabs({ tabs, activeTabId, onSelect, onClose, onAdd }: BrowserTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border bg-card/80 px-2 py-1.5 shrink-0">
      <div className="flex flex-1 min-w-0 items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`group flex max-w-[220px] min-w-[120px] items-center gap-1 rounded-lg border px-2 py-1 text-xs transition ${
                active
                  ? "border-border bg-secondary text-foreground"
                  : "border-transparent bg-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                className="min-w-0 flex-1 truncate text-left"
                title={tab.url}
              >
                {tabLabel(tab)}
              </button>
              {tabs.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onClose(tab.id)}
                  className="rounded p-0.5 opacity-0 transition hover:bg-background/80 group-hover:opacity-100"
                  aria-label="Close tab"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        aria-label="New tab"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
