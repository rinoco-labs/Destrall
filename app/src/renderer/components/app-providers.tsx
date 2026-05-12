import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import {
  useSettingsStore,
  RTL_LANGUAGES,
  type ResolvedTheme,
} from "@/stores/settingsStore";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Mounts side-effects that sync the settings store to the document:
 *  - applies dark/light class
 *  - applies html[lang] and dir
 *  - keeps i18next in sync with the store
 *  - watches OS theme when theme === "system"
 *
 * Renders nothing.
 */
export function AppProviders() {
  const { i18n: i18nInstance } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const language = useSettingsStore((s) => s.language);
  const hasHydrated = useSettingsStore((s) => s.hasHydrated);
  const setResolvedTheme = useSettingsStore((s) => s.setResolvedTheme);

  // Theme application
  useEffect(() => {
    if (typeof document === "undefined") return;
    const apply = () => {
      const resolved: ResolvedTheme =
        theme === "system" ? getSystemTheme() : theme;
      document.documentElement.classList.toggle("dark", resolved === "dark");
      setResolvedTheme(resolved);
    };
    apply();

    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, setResolvedTheme, hasHydrated]);

  // Language + direction application
  useEffect(() => {
    if (typeof document === "undefined") return;
    const isRTL = RTL_LANGUAGES.includes(language);
    document.documentElement.lang = language;
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    if (i18nInstance.language !== language) {
      void i18nInstance.changeLanguage(language);
    }
    // ensure singleton stays in sync too
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [language, i18nInstance]);

  return null;
}
