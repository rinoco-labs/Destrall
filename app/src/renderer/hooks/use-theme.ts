import { useSettingsStore } from "@/stores/settingsStore";

export type Theme = "light" | "dark";

/**
 * Backwards-compatible thin wrapper around the settings store.
 * Existing components keep working: `theme` is the resolved value
 * and `toggle` flips between dark and light explicitly (away from "system").
 */
export function useTheme() {
  const theme = useSettingsStore((s) => s.resolvedTheme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const toggle = useSettingsStore((s) => s.toggleTheme);

  return {
    theme: theme as Theme,
    setTheme: (t: Theme) => setTheme(t),
    toggle,
  };
}
