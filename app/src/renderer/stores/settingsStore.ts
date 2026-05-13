import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ThemePref = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";
export type AppLanguage = "en" | "fr" | "ko" | "ja" | "ar" | "es" | "zh";
export type AppCurrency = "USD" | "EUR" | "GBP" | "JPY" | "KRW" | "CNY" | "AED";
export type AutoLockMinutes = number;
export type AiPersonality = "default" | "concise" | "playful" | "formal" | "expert";

export const RTL_LANGUAGES: AppLanguage[] = ["ar"];

export const SUPPORTED_LANGUAGES: { code: AppLanguage; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "fr", label: "French", native: "Français" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "zh", label: "Mandarin Chinese", native: "中文" },
  { code: "ar", label: "Arabic", native: "العربية" },
];

export const SUPPORTED_CURRENCIES: { code: AppCurrency; label: string; symbol: string }[] = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥" },
  { code: "KRW", label: "South Korean Won", symbol: "₩" },
  { code: "CNY", label: "Chinese Yuan", symbol: "¥" },
  { code: "AED", label: "UAE Dirham", symbol: "د.إ" },
];

export const AUTO_LOCK_OPTIONS: { value: AutoLockMinutes; label: string }[] = [
  { value: 1, label: "1 minute" },
  { value: 3, label: "3 minutes" },
  { value: 5, label: "5 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
];

export const AI_PERSONALITIES: { id: AiPersonality; name: string; description: string }[] = [
  { id: "default", name: "Default", description: "Helpful, balanced, and neutral." },
  { id: "concise", name: "Concise", description: "Short, direct answers without fluff." },
  { id: "playful", name: "Playful", description: "Friendly tone with a touch of humor." },
  { id: "formal", name: "Formal", description: "Professional and precise communication." },
  { id: "expert", name: "Expert", description: "Deep, technical, and thorough explanations." },
];

type SettingsState = {
  theme: ThemePref;
  resolvedTheme: ResolvedTheme;
  language: AppLanguage;
  isRTL: boolean;
  currency: AppCurrency;
  autoLockMinutes: AutoLockMinutes;
  aiPersonality: AiPersonality;
  hasHydrated: boolean;
  setTheme: (t: ThemePref) => void;
  setResolvedTheme: (t: ResolvedTheme) => void;
  setLanguage: (lang: AppLanguage) => void;
  setCurrency: (c: AppCurrency) => void;
  setAutoLockMinutes: (m: AutoLockMinutes) => void;
  setAiPersonality: (p: AiPersonality) => void;
  toggleTheme: () => void;
  setHasHydrated: (h: boolean) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      resolvedTheme: "dark",
      language: "en",
      isRTL: false,
      currency: "USD",
      autoLockMinutes: 3,
      aiPersonality: "default",
      hasHydrated: false,
      setTheme: (theme) => set({ theme }),
      setResolvedTheme: (resolvedTheme) => set({ resolvedTheme }),
      setLanguage: (language) =>
        set({ language, isRTL: RTL_LANGUAGES.includes(language) }),
      setCurrency: (currency) => set({ currency }),
      setAutoLockMinutes: (autoLockMinutes) => set({ autoLockMinutes }),
      setAiPersonality: (aiPersonality) => set({ aiPersonality }),
      toggleTheme: () => {
        const current = get().resolvedTheme;
        set({ theme: current === "dark" ? "light" : "dark" });
      },
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "destrall.settings",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? (undefined as unknown as Storage)
          : localStorage,
      ),
      partialize: (s) => ({
        theme: s.theme,
        language: s.language,
        currency: s.currency,
        autoLockMinutes: s.autoLockMinutes,
        aiPersonality: s.aiPersonality,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
