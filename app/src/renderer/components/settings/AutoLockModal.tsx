import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AUTO_LOCK_OPTIONS, type AutoLockMinutes } from "@/stores/settingsStore";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: AutoLockMinutes;
  onSelect: (value: AutoLockMinutes) => void;
};

export function AutoLockModal({ open, onOpenChange, value, onSelect }: Props) {
  const isPreset = AUTO_LOCK_OPTIONS.some((o) => o.value === value);
  const [customValue, setCustomValue] = useState<string>(
    isPreset ? "" : String(value),
  );

  useEffect(() => {
    if (open) setCustomValue(isPreset ? "" : String(value));
  }, [open, value, isPreset]);

  const handlePreset = (v: number) => {
    onSelect(v);
    onOpenChange(false);
  };

  const handleSaveCustom = () => {
    const n = parseInt(customValue, 10);
    if (!Number.isFinite(n) || n < 1 || n > 1440) return;
    onSelect(n);
    onOpenChange(false);
  };

  const customNum = parseInt(customValue, 10);
  const customValid = Number.isFinite(customNum) && customNum >= 1 && customNum <= 1440;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card/95 backdrop-blur border-border max-w-md">
        <DialogHeader>
          <DialogTitle>Auto-Lock Timeout</DialogTitle>
          <DialogDescription>
            Lock the app automatically after a period of inactivity.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 max-h-[60vh] overflow-y-auto -mx-2 px-2 space-y-1">
          {AUTO_LOCK_OPTIONS.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handlePreset(opt.value)}
                className={cn(
                  "w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition",
                  active
                    ? "border-brand/60 bg-brand/10"
                    : "border-border bg-card/40 hover:bg-secondary/40",
                )}
              >
                <span className="flex-1 text-sm font-medium text-foreground">
                  {opt.label}
                </span>
                {active && <Check className="w-4 h-4 text-brand shrink-0" />}
              </button>
            );
          })}

          <div
            className={cn(
              "rounded-xl border px-4 py-3 transition",
              !isPreset
                ? "border-brand/60 bg-brand/10"
                : "border-border bg-card/40",
            )}
          >
            <p className="text-sm font-medium text-foreground mb-2">
              Custom
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Enter a value in minutes (1–1440).
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={1440}
                inputMode="numeric"
                placeholder="e.g. 10"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                className="h-10 bg-background/60"
              />
              <span className="text-xs text-muted-foreground">min</span>
              <Button
                type="button"
                disabled={!customValid}
                onClick={handleSaveCustom}
                className="h-10 bg-brand/20 hover:bg-brand/30 text-foreground border border-brand/40"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
