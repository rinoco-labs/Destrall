import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getDeviceLocale, getDeviceTimezone } from "../../services/time/timezone.service";

export type ClockFormat = "12h" | "24h";

type TimezoneState = {
  timezone: string;
  locale: string;
  clockFormat: ClockFormat;
  hasHydrated: boolean;
  setTimezone: (tz: string) => void;
  setLocale: (locale: string) => void;
  setClockFormat: (format: ClockFormat) => void;
  resetToDevice: () => void;
};

export const useTimezoneStore = create<TimezoneState>()(
  persist(
    (set) => ({
      timezone: getDeviceTimezone(),
      locale: getDeviceLocale(),
      clockFormat: "12h",
      hasHydrated: false,
      setTimezone: (timezone) => set({ timezone }),
      setLocale: (locale) => set({ locale }),
      setClockFormat: (clockFormat) => set({ clockFormat }),
      resetToDevice: () =>
        set({
          timezone: getDeviceTimezone(),
          locale: getDeviceLocale(),
        }),
    }),
    {
      name: "destrall-timezone",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) state.hasHydrated = true;
      },
    },
  ),
);
