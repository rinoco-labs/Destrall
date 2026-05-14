import { useEffect, useState } from "react";
import { Download, Loader2, RefreshCw, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { isDestrallDesktop } from "@/lib/desktopWallet";
import { useAiModelStore } from "@/stores/aiModelStore";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
};

function statusLabel(s: {
  error: string | null;
  isDownloading: boolean;
  isLoading: boolean;
  isLoaded: boolean;
  isDownloaded: boolean;
}): string {
  if (s.error && !s.isDownloading && !s.isLoading) return "Error";
  if (s.isDownloading) return "Downloading";
  if (s.isLoading) return "Loading";
  if (s.isLoaded) return "Loaded";
  if (s.isDownloaded) return "Ready";
  return "Not downloaded";
}

export function AiModelModal({ open, onOpenChange, title, description }: Props) {
  const refreshFromMain = useAiModelStore((s) => s.refreshFromMain);
  const isDownloading = useAiModelStore((s) => s.isDownloading);
  const downloadProgress = useAiModelStore((s) => s.downloadProgress);
  const isLoading = useAiModelStore((s) => s.isLoading);
  const isLoaded = useAiModelStore((s) => s.isLoaded);
  const isDownloaded = useAiModelStore((s) => s.isDownloaded);
  const error = useAiModelStore((s) => s.error);
  const downloadModel = useAiModelStore((s) => s.downloadModel);
  const loadModel = useAiModelStore((s) => s.loadModel);
  const deleteModel = useAiModelStore((s) => s.deleteModel);
  const cancelDownload = useAiModelStore((s) => s.cancelDownload);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !isDestrallDesktop()) return;
    void refreshFromMain();
  }, [open, refreshFromMain]);

  const status = statusLabel({ error, isDownloading, isLoading, isLoaded, isDownloaded });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card/95 backdrop-blur border-border max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="mt-2 rounded-xl border border-border bg-card/40 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Status</p>
          <p className="text-sm font-semibold text-foreground mt-1">{status}</p>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {isDownloading ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">Downloading… {downloadProgress}%</p>
            <Progress value={downloadProgress} className="h-2" />
            <button
              type="button"
              className="text-xs font-semibold text-brand hover:underline"
              onClick={() => void cancelDownload()}
            >
              Cancel download
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {!isDownloaded ? (
            <button
              type="button"
              disabled={busy || isDownloading}
              onClick={async () => {
                setBusy(true);
                try {
                  await downloadModel();
                } finally {
                  setBusy(false);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 text-brand px-4 py-2 text-sm font-semibold hover:bg-brand/20 transition disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download AI
            </button>
          ) : null}

          {isDownloaded ? (
            <>
              <button
                type="button"
                disabled={busy || isDownloading || isLoading}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await loadModel();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 text-brand px-4 py-2 text-sm font-semibold hover:bg-brand/20 transition disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Reload AI
              </button>
              <button
                type="button"
                disabled={busy || isDownloading}
                onClick={async () => {
                  if (!confirm("Delete the assistant AI from this device? You can download it again later.")) {
                    return;
                  }
                  setBusy(true);
                  try {
                    await deleteModel();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 text-destructive px-4 py-2 text-sm font-semibold hover:bg-destructive/10 transition disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete AI
              </button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
