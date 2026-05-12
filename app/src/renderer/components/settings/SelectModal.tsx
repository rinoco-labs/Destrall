import { ReactNode } from "react";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
  description?: string;
  trailing?: ReactNode;
};

type Props<T extends string | number> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  value: T;
  options: SelectOption<T>[];
  onSelect: (value: T) => void;
};

export function SelectModal<T extends string | number>({
  open,
  onOpenChange,
  title,
  description,
  value,
  options,
  onSelect,
}: Props<T>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card/95 backdrop-blur border-border max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="mt-2 max-h-[60vh] overflow-y-auto -mx-2 px-2 space-y-1">
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onSelect(opt.value);
                  onOpenChange(false);
                }}
                className={cn(
                  "w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border transition",
                  active
                    ? "border-brand/60 bg-brand/10"
                    : "border-border bg-card/40 hover:bg-secondary/40",
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {opt.label}
                    </span>
                    {opt.trailing}
                  </div>
                  {opt.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {opt.description}
                    </p>
                  )}
                </div>
                {active && <Check className="w-4 h-4 text-brand mt-1 shrink-0" />}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
