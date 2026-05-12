import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import fr from "./locales/fr.json";
import es from "./locales/es.json";
import ko from "./locales/ko.json";
import ja from "./locales/ja.json";
import zh from "./locales/zh.json";
import ar from "./locales/ar.json";

export const resources = {
  en: { translation: en },
  fr: { translation: fr },
  es: { translation: es },
  ko: { translation: ko },
  ja: { translation: ja },
  zh: { translation: zh },
  ar: { translation: ar },
} as const;

if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: "en",
      supportedLngs: ["en", "fr", "es", "ko", "ja", "zh", "ar"],
      lng: typeof window === "undefined" ? "en" : undefined,
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator", "htmlTag"],
        caches: ["localStorage"],
        lookupLocalStorage: "destrall.i18n",
      },
      returnNull: false,
    });
}

export default i18n;
