import { useState } from "react";
import { Check, CheckCircle2, Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AI_MODELS, AiModelId, useSettingsStore } from "@/stores/settingsStore";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
};

export function AiModelModal({ open, onOpenChange, title, description }: Props) {
  const aiModel = useSettingsStore((s) => s.aiModel);
  const installed = useSettingsStore((s) => s.installedAiModels);
  const setAiModel = useSettingsStore((s) => s.setAiModel);
  const installAiModel = useSettingsStore((s) => s.installAiModel);
  const [downloading, setDownloading] = useState<AiModelId | null>(null);

  const handleDownload = (id: AiModelId) => {
    if (downloading) return;
    setDownloading(id);
    setTimeout(() => {
      installAiModel(id);
      setDownloading((d) => (d === id ? null : d));
    }, 1600);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card/95 backdrop-blur border-border max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="mt-2 max-h-[60vh] overflow-y-auto -mx-2 px-2 space-y-1">
          {AI_MODELS.map((m) => {
            const isInstalled = installed.includes(m.id);
            const active = m.id === aiModel;
            const isDownloading = downloading === m.id;

            const handleRowClick = () => {
              if (!isInstalled) {
                handleDownload(m.id);
                return;
              }
              setAiModel(m.id);
              onOpenChange(false);
            };

            return (
              <div
                key={m.id}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 rounded-xl border transition",
                  active
                    ? "border-brand/60 bg-brand/10"
                    : "border-border bg-card/40 hover:bg-secondary/40",
                )}
              >
                <button
                  type="button"
                  onClick={handleRowClick}
                  disabled={isDownloading}
                  className="flex-1 min-w-0 text-left disabled:opacity-70"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      {m.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded-full px-2 py-0.5">
                      {m.size}
                    </span>
                    {isInstalled && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-500 border border-emerald-500/40 bg-emerald-500/10 rounded-full px-2 py-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                        Installed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {m.description}
                  </p>
                </button>

                <div className="shrink-0 flex items-center mt-0.5">
                  {isInstalled ? (
                    active ? (
                      <Check className="w-4 h-4 text-brand" />
                    ) : null
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDownload(m.id)}
                      disabled={isDownloading}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 text-brand px-3 py-1 text-xs font-semibold hover:bg-brand/20 transition disabled:opacity-70"
                    >
                      {isDownloading ? (
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
