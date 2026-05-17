import type { RefObject } from "react";

/**
 * Native dapp surface is rendered by Electron WebContentsView (see main/browser/nativeBrowserViewManager).
 * This component marks the viewport region in the React layout; bounds sync via IPC.
 */
export function BrowserWebView({ viewportRef }: { viewportRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={viewportRef}
      className="relative min-h-0 flex-1 bg-transparent"
      aria-label="Dapp browser viewport"
    />
  );
}
