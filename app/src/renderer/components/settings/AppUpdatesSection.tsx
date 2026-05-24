import { useState } from "react";
import { Download, ExternalLink, FolderOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUpdateStore } from "@/stores/updateStore";
import type { UpdateInfo } from "../../shared/update";

function statusLabel(status: UpdateInfo["status"]): string {
  switch (status) {
    case "checking":
      return "Checking for updates…";
    case "available":
      return "Update available";
    case "not_available":
      return "Up to date";
    case "downloading":
      return "Downloading update…";
    case "downloaded":
      return "Update downloaded";
    case "error":
      return "Update error";
    default:
      return "Ready to check";
  }
}

export function AppUpdatesSection() {
  const status = useUpdateStore((s) => s.status);
  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates);
  const downloadUpdate = useUpdateStore((s) => s.downloadUpdate);
  const openDownloaded = useUpdateStore((s) => s.openDownloaded);
  const revealDownloaded = useUpdateStore((s) => s.revealDownloaded);
  const openReleasePage = useUpdateStore((s) => s.openReleasePage);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currentVersion = status?.currentVersion ?? "—";
  const latestVersion = status?.latestVersion;
  const updateStatus = status?.status ?? "idle";

  const run = async (action: () => Promise<void>) => {
    setActionError(null);
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/40 backdrop-blur overflow-hidden">
      <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
        <InfoRow label="Current version" value={currentVersion} />
        <InfoRow label="Latest version" value={latestVersion ?? "—"} />
        <InfoRow label="Status" value={statusLabel(updateStatus)} className="sm:col-span-2" />
      </div>

      {status?.releaseNotes ? (
        <div className="border-t border-border px-5 py-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Release notes</p>
          <div className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
            {status.releaseNotes}
          </div>
        </div>
      ) : null}

      {actionError ? <p className="px-5 pb-2 text-sm text-destructive">{actionError}</p> : null}
      {status?.error && updateStatus === "error" ? (
        <p className="px-5 pb-2 text-sm text-destructive">{status.error}</p>
      ) : null}

      {updateStatus === "downloaded" ? (
        <p className="px-5 pb-3 text-sm text-muted-foreground">
          Update downloaded. Open the installer to update Destrall. Your wallet data is stored
          separately from the app installation.
        </p>
      ) : null}

      {updateStatus === "downloading" && status?.progress ? (
        <div className="space-y-2 px-5 pb-4">
          <Progress value={status.progress.percent} />
          <p className="text-xs text-muted-foreground">{status.progress.percent}% downloaded</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 px-5 pb-5">
        {(updateStatus === "idle" || updateStatus === "not_available" || updateStatus === "error") && (
          <Button
            type="button"
            variant="secondary"
            disabled={busy || updateStatus === "checking"}
            onClick={() => void run(() => checkForUpdates())}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {updateStatus === "error" ? "Try again" : "Check for updates"}
          </Button>
        )}

        {updateStatus === "checking" ? (
          <Button type="button" variant="secondary" disabled>
            Checking for updates…
          </Button>
        ) : null}

        {updateStatus === "not_available" ? (
          <p className="self-center text-sm text-muted-foreground">Destrall is up to date.</p>
        ) : null}

        {updateStatus === "available" ? (
          <>
            <Button type="button" disabled={busy} onClick={() => void run(() => downloadUpdate())}>
              <Download className="mr-2 h-4 w-4" />
              Download update
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void run(() => openReleasePage())}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View release notes
            </Button>
          </>
        ) : null}

        {updateStatus === "downloaded" ? (
          <>
            <Button type="button" disabled={busy} onClick={() => void run(() => openDownloaded())}>
              Open installer
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void run(() => revealDownloaded())}
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              Show in folder
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
