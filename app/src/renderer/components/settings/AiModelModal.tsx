import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Download,
  Loader2,
  Trash2,
  Power,
  PowerOff,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { isDestrallDesktop } from "@/lib/desktopWallet";
import { useAiModelStore } from "@/stores/aiModelStore";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
};

export function AiModelModal({ open, onOpenChange, title, description }: Props) {
  const refreshFromMain = useAiModelStore((s) => s.refreshFromMain);
  const models = useAiModelStore((s) => s.availableModels);
  const isDownloading = useAiModelStore((s) => s.isDownloading);
  const downloadProgress = useAiModelStore((s) => s.downloadProgress);
  const downloadingModelId = useAiModelStore((s) => s.downloadingModelId);
  const isLoadingModel = useAiModelStore((s) => s.isLoadingModel);
  const isModelLoaded = useAiModelStore((s) => s.isModelLoaded);
  const activeModelId = useAiModelStore((s) => s.activeModelId);
  const lastError = useAiModelStore((s) => s.lastError);
  const downloadModel = useAiModelStore((s) => s.downloadModel);
  const loadModel = useAiModelStore((s) => s.loadModel);
  const unloadModel = useAiModelStore((s) => s.unloadModel);
  const deleteModel = useAiModelStore((s) => s.deleteModel);
  const cancelDownload = useAiModelStore((s) => s.cancelDownload);

  const [rowBusy, setRowBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !isDestrallDesktop()) return;
    void refreshFromMain();
  }, [open, refreshFromMain]);

  const sizeLabel = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes >= 1024 ** 3) return `~${(bytes / 1024 ** 3).toFixed(2)} GB`;
    return `~${(bytes / 1024 ** 2).toFixed(0)} MB`;
  };

  const statusLabel = (modelId: string, installed: boolean) => {
    if (downloadingModelId === modelId && isDownloading) return "Downloading";
    if (isLoadingModel && rowBusy === modelId) return "Loading";
    if (installed && isModelLoaded && activeModelId === modelId) return "Loaded";
    if (installed) return "Downloaded";
    return "Not downloaded";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card/95 backdrop-blur border-border max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {lastError ? (
          <p className="text-sm text-destructive mt-2" role="alert">
            {lastError}
          </p>
        ) : null}

        {isDownloading && downloadingModelId ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Downloading… {downloadProgress}%
            </p>
            <Progress value={downloadProgress} className="h-2" />
            <button
              type="button"
              className="text-xs font-semibold text-brand hover:underline"
              onClick={() => void cancelDownload(downloadingModelId)}
            >
              Cancel download
            </button>
          </div>
        ) : null}

        <div className="mt-3 space-y-2">
          {models.map((m) => {
            const busy = rowBusy === m.id;
            const isDl = downloadingModelId === m.id && isDownloading;
            const installed = m.installed;
            const isActive = isModelLoaded && activeModelId === m.id;

            return (
              <div
                key={m.id}
                className={cn(
                  "rounded-xl border px-4 py-3 transition",
                  isActive ? "border-brand/60 bg-brand/10" : "border-border bg-card/40",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{m.name}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded-full px-2 py-0.5">
                        {sizeLabel(m.sizeBytes)}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border border-border rounded-full px-2 py-0.5">
                        {statusLabel(m.id, installed)}
                      </span>
                      {installed && !isDl && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-500 border border-emerald-500/40 bg-emerald-500/10 rounded-full px-2 py-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          On disk
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {!installed ? (
                    <button
                      type="button"
                      disabled={isDl || !!downloadingModelId}
                      onClick={async () => {
                        setRowBusy(m.id);
                        try {
                          await downloadModel(m.id);
                        } finally {
                          setRowBusy(null);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 text-brand px-3 py-1 text-xs font-semibold hover:bg-brand/20 transition disabled:opacity-50"
                    >
                      {isDl ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Downloading
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </>
                      )}
                    </button>
                  ) : (
                    <>
                      {!isActive ? (
                        <button
                          type="button"
                          disabled={busy || isDownloading || isLoadingModel}
                          onClick={async () => {
                            setRowBusy(m.id);
                            try {
                              await loadModel(m.id);
                            } finally {
                              setRowBusy(null);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 text-brand px-3 py-1 text-xs font-semibold hover:bg-brand/20 transition disabled:opacity-50"
                        >
                          {busy && isLoadingModel ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Power className="w-3.5 h-3.5" />
                          )}
                          Load
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setRowBusy(m.id);
                            try {
                              await unloadModel();
                            } finally {
                              setRowBusy(null);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-secondary/60 transition disabled:opacity-50"
                        >
                          <PowerOff className="w-3.5 h-3.5" />
                          Unload
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy || isDl}
                        onClick={async () => {
                          if (!confirm(`Delete ${m.name} from this device?`)) return;
                          setRowBusy(m.id);
                          try {
                            await deleteModel(m.id);
                          } finally {
                            setRowBusy(null);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 text-destructive px-3 py-1 text-xs font-semibold hover:bg-destructive/10 transition disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500">
                          <Check className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
