import { getDatabase } from "../../main/persistence/database";

const TZ_KEY = "user_timezone";
const LOCALE_KEY = "user_locale";
const CLOCK_24H_KEY = "user_clock_24h";

export type TimezonePreferences = {
  timezone: string;
  locale: string;
  clock24h: boolean;
};

function detectDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function detectDeviceLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
  } catch {
    return "en-US";
  }
}

class TimezoneSettingsService {
  private getValue(key: string): string | null {
    const row = getDatabase()
      .prepare(`SELECT value FROM app_settings WHERE key = ?`)
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  private setValue(key: string, value: string) {
    const now = Date.now();
    getDatabase()
      .prepare(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, value, now);
  }

  initialize() {
    if (!this.getValue(TZ_KEY)) {
      this.setValue(TZ_KEY, detectDeviceTimezone());
    }
    if (!this.getValue(LOCALE_KEY)) {
      this.setValue(LOCALE_KEY, detectDeviceLocale());
    }
    if (!this.getValue(CLOCK_24H_KEY)) {
      this.setValue(CLOCK_24H_KEY, "false");
    }
  }

  getPreferences(): TimezonePreferences {
    this.initialize();
    return {
      timezone: this.getValue(TZ_KEY) ?? detectDeviceTimezone(),
      locale: this.getValue(LOCALE_KEY) ?? detectDeviceLocale(),
      clock24h: this.getValue(CLOCK_24H_KEY) === "true",
    };
  }

  getTimezone(): string {
    return this.getPreferences().timezone;
  }

  setTimezone(timezone: string) {
    this.setValue(TZ_KEY, timezone);
  }

  setLocale(locale: string) {
    this.setValue(LOCALE_KEY, locale);
  }

  setClock24h(clock24h: boolean) {
    this.setValue(CLOCK_24H_KEY, clock24h ? "true" : "false");
  }
}

export const timezoneSettingsService = new TimezoneSettingsService();

/** Device timezone when no override stored (renderer bootstrap). */
export function getDeviceTimezone(): string {
  return detectDeviceTimezone();
}

export function getDeviceLocale(): string {
  return detectDeviceLocale();
}
