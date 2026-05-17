import { type KeyboardEvent } from "react";
import { BadgeCheck, Pin, Star } from "lucide-react";
import type { BrowserDappDefinition } from "../../config/browser/chains";
import { BrowserDappIcon } from "./BrowserDappIcon";

export type BrowserDappCardProps = {
  dapp: BrowserDappDefinition;
  isFavorite?: boolean;
  isPinned?: boolean;
  onOpen: () => void;
  onToggleFavorite?: () => void;
  onTogglePin?: () => void;
  compact?: boolean;
};

export function BrowserDappCard({
  dapp,
  isFavorite = false,
  isPinned = false,
  onOpen,
  onToggleFavorite,
  onTogglePin,
  compact = false,
}: BrowserDappCardProps) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className={`group relative flex cursor-pointer flex-col rounded-2xl border border-border bg-card/70 text-left transition hover:border-primary/30 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
        compact ? "gap-2.5 p-3" : "gap-3 p-4"
      }`}
    >
      <div className="flex items-start gap-3">
        <BrowserDappIcon name={dapp.name} iconUrl={dapp.iconUrl} size={compact ? "sm" : "md"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-foreground">{dapp.name}</h3>
            {dapp.verified ? (
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-label="Verified" />
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {dapp.description}
          </p>
        </div>
      </div>

      {onToggleFavorite || onTogglePin ? (
        <div className="flex items-center justify-end gap-2">
          {onToggleFavorite ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className={`rounded-xl border p-2 transition ${
                isFavorite
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                  : "border-border text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
              aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
            >
              <Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
            </button>
          ) : null}
          {onTogglePin ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
              className={`rounded-xl border p-2 transition ${
                isPinned
                  ? "border-sky-500/40 bg-sky-500/10 text-sky-400"
                  : "border-border text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
              aria-label={isPinned ? "Unpin" : "Pin"}
            >
              <Pin className={`h-4 w-4 ${isPinned ? "fill-current" : ""}`} />
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
