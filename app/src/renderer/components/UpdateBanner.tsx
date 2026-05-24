import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useUpdateStore } from "@/stores/updateStore";
import { isDestrallDesktop } from "@/lib/desktopWallet";

export function UpdateBanner() {
  const status = useUpdateStore((s) => s.status);
  const bannerDismissed = useUpdateStore((s) => s.bannerDismissed);
  const downloadUpdate = useUpdateStore((s) => s.downloadUpdate);
  const openDownloaded = useUpdateStore((s) => s.openDownloaded);
  const dismissBanner = useUpdateStore((s) => s.dismissBanner);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isDestrallDesktop() || bannerDismissed || !status) {
    return null;
  }

  const showAvailable = status.status === "available";
  const showDownloaded = status.status === "downloaded";
  if (!showAvailable && !showDownloaded) {
    return null;
  }

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999] flex justify-center px-4 pt-3">
      <div className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {showDownloaded
              ? "Update downloaded. Open the installer to update."
              : "A new Destrall update is available."}
          </p>
          {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showAvailable ? (
            <Button type="button" size="sm" disabled={busy} onClick={() => void run(() => downloadUpdate())}>
              Download
            </Button>
          ) : null}
          {showDownloaded ? (
            <Button type="button" size="sm" disabled={busy} onClick={() => void run(() => openDownloaded())}>
              Open installer
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => dismissBanner()}>
            Later
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link to="/settings">Settings</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
