import { Moon, Sun, Monitor } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettingsStore, type ThemePref } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePref; icon: React.ComponentType<{ className?: string }>; key: string }[] = [
  { value: "light", icon: Sun, key: "settings.light" },
  { value: "dark", icon: Moon, key: "settings.dark" },
  { value: "system", icon: Monitor, key: "settings.system" },
];

export function ThemeSelector({ className }: { className?: string }) {
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-card/40 p-1",
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition",
              active
                ? "bg-brand text-brand-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={active}
          >
            <Icon className="w-3.5 h-3.5" />
            {t(opt.key)}
          </button>
        );
      })}
    </div>
  );
}
