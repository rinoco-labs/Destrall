import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Loader2,
  Lock,
  MoreVertical,
  RefreshCw,
  X,
} from "lucide-react";

export type BrowserHeaderProps = {
  urlInput: string;
  isLoading: boolean;
  isHomeTab?: boolean;
  searchPlaceholder?: string;
  onUrlInputChange: (value: string) => void;
  onSubmitUrl: () => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onClearUrl?: () => void;
};

function isSecureUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return /^https:\/\//i.test(value.trim());
  }
}

export function BrowserHeader({
  urlInput,
  isLoading,
  isHomeTab = false,
  searchPlaceholder = "Search or enter URL",
  onUrlInputChange,
  onSubmitUrl,
  onBack,
  onForward,
  onReload,
  onClearUrl,
}: BrowserHeaderProps) {
  const secure = !isHomeTab && isSecureUrl(urlInput);

  return (
    <div className="flex items-center gap-1.5 border-b border-border bg-background/95 px-2 py-2 backdrop-blur shrink-0">
      <button
        type="button"
        onClick={onBack}
        className="rounded-lg p-2 text-muted-foreground hover:bg-secondary/60"
        aria-label="Back"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onForward}
        className="rounded-lg p-2 text-muted-foreground hover:bg-secondary/60"
        aria-label="Forward"
      >
        <ArrowRight className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onReload}
        className="rounded-lg p-2 text-muted-foreground hover:bg-secondary/60"
        aria-label="Reload"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
      </button>

      <form
        className="flex min-w-0 flex-1 items-center"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmitUrl();
        }}
      >
        <div className="flex w-full items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2">
          <Lock
            className={`h-3.5 w-3.5 shrink-0 ${secure ? "text-emerald-500" : "text-muted-foreground/50"}`}
            aria-hidden
          />
          <input
            type="text"
            value={urlInput}
            onChange={(e) => onUrlInputChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
            spellCheck={false}
          />
          {urlInput.trim() && onClearUrl ? (
            <button
              type="button"
              onClick={onClearUrl}
              className="rounded p-0.5 text-muted-foreground hover:bg-background/60 hover:text-foreground"
              aria-label="Clear URL"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </form>

      <button
        type="button"
        className="rounded-lg p-2 text-muted-foreground hover:bg-secondary/60"
        aria-label="History"
      >
        <Clock className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="rounded-lg p-2 text-muted-foreground hover:bg-secondary/60"
        aria-label="Browser menu"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    </div>
  );
}
