import type { TriggerTimeSchedule } from "../../packages/core/triggers/triggers.types";

/** Recurrence model reusable by triggers and future server keepers. */
export type RecurrenceType = "once" | "daily" | "weekly" | "monthly" | "interval_hours";

export type RecurrenceSchedule = {
  type: RecurrenceType;
  hour?: number;
  minute?: number;
  weekday?: number;
  dayOfMonth?: number;
  intervalHours?: number;
  timezone: string;
  /** UTC ISO for one-shot execution */
  onceAtUtc?: string;
};

export type ParsedNaturalSchedule =
  | {
      ok: true;
      schedule: TriggerTimeSchedule;
      recurrence: RecurrenceSchedule;
      /** Human label: "May 15 • 6:00 AM • Asia/Ho_Chi_Minh" */
      displayLabel: string;
      /** UTC instant for next run */
      nextUtcIso: string;
      isRecurring: boolean;
    }
  | {
      ok: false;
      missing: string[];
      needsClarification?: "ampm" | "date" | "time";
      partialHour?: number;
      partialDateLabel?: string;
    };

export type TimeContextSnapshot = {
  localTimeIso: string;
  localTimeFormatted: string;
  timezone: string;
  utcTimeIso: string;
  utcOffset: string;
  weekday: string;
  locale: string;
  clock24h: boolean;
};

export type CurrentTimePayload = {
  localTime: string;
  timezone: string;
  utcTime: string;
  formatted: string;
  weekday: string;
  utcOffset: string;
};
