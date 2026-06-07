import type { TriggerTimeSchedule } from "../../packages/core/triggers/triggers.types.ts";
import type { CurrentTimePayload, TimeContextSnapshot } from "./time.types.ts";
import { timezoneSettingsService } from "./timezone.service.ts";
import {
  nextDailyOccurrence,
  nextWeeklyOccurrence,
  parseNaturalSchedule,
  stripSchedulePhrases,
} from "./schedule-parser.ts";
import {
  convertLocalPartsToUtc,
  formatCountdown,
  getUtcOffsetLabel,
  getZonedParts,
  isPastDate,
  pad2,
  to24Hour,
} from "./time-utils.ts";

export { parseNaturalSchedule, stripSchedulePhrases } from "./schedule-parser.ts";
export type { ParsedNaturalSchedule, RecurrenceSchedule, TimeContextSnapshot, CurrentTimePayload } from "./time.types.ts";
export { convertLocalPartsToUtc, getZonedParts, pad2, to24Hour } from "./time-utils.ts";

export function getCurrentTime(): Date {
  return new Date();
}

export function getCurrentUtcTime(): Date {
  return new Date();
}

export function getCurrentTimezone(): string {
  return timezoneSettingsService.getTimezone();
}

export function convertUtcToLocal(date: Date, timezone: string): Date {
  const p = getZonedParts(date, timezone);
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute);
}

export function convertLocalToUtc(date: Date, timezone: string): Date {
  const p = getZonedParts(date, timezone);
  return convertLocalPartsToUtc(p.year, p.month, p.day, p.hour, p.minute, timezone);
}

export { isPastDate, getUtcOffsetLabel };

export function formatLocalTime(date: Date = new Date(), timezone?: string, clock24h?: boolean): string {
  const tz = timezone ?? getCurrentTimezone();
  const prefs = timezoneSettingsService.getPreferences();
  const use24 = clock24h ?? prefs.clock24h;
  try {
    return new Intl.DateTimeFormat(prefs.locale, {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: !use24,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function formatUtcTime(date: Date = new Date()): string {
  return date.toISOString();
}

export function formatScheduleDisplay(date: Date, timezone?: string): string {
  const tz = timezone ?? getCurrentTimezone();
  const prefs = timezoneSettingsService.getPreferences();
  try {
    const datePart = new Intl.DateTimeFormat(prefs.locale, {
      timeZone: tz,
      month: "short",
      day: "numeric",
    }).format(date);
    const timePart = new Intl.DateTimeFormat(prefs.locale, {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: !prefs.clock24h,
    }).format(date);
    return `${datePart} • ${timePart} • ${tz}`;
  } catch {
    return date.toISOString();
  }
}

export { formatCountdown };

export function buildTimeContextSnapshot(now: Date = new Date()): TimeContextSnapshot {
  const prefs = timezoneSettingsService.getPreferences();
  const tz = prefs.timezone;
  const weekdayFmt = new Intl.DateTimeFormat(prefs.locale, { timeZone: tz, weekday: "long" });
  return {
    localTimeIso: formatLocalTime(now, tz, prefs.clock24h),
    localTimeFormatted: formatLocalTime(now, tz, prefs.clock24h),
    timezone: tz,
    utcTimeIso: now.toISOString(),
    utcOffset: getUtcOffsetLabel(tz, now),
    weekday: weekdayFmt.format(now),
    locale: prefs.locale,
    clock24h: prefs.clock24h,
  };
}

export function buildAssistantTimeContextBlock(): string {
  const snap = buildTimeContextSnapshot();
  return [
    "[TIME_CONTEXT]",
    "",
    "Local time:",
    snap.localTimeFormatted,
    "",
    "Timezone:",
    snap.timezone,
    "",
    "UTC offset:",
    snap.utcOffset,
    "",
    "Weekday:",
    snap.weekday,
    "",
    "[/TIME_CONTEXT]",
  ].join("\n");
}

export function assistantTimeContextLines(): string[] {
  const snap = buildTimeContextSnapshot();
  return [
    `LOCAL_TIME: ${snap.localTimeFormatted}`,
    `TIMEZONE: ${snap.timezone}`,
    `UTC_OFFSET: ${snap.utcOffset}`,
    `WEEKDAY: ${snap.weekday}`,
  ];
}

export function getCurrentTimePayload(): CurrentTimePayload {
  const snap = buildTimeContextSnapshot();
  return {
    localTime: snap.localTimeFormatted,
    timezone: snap.timezone,
    utcTime: snap.utcTimeIso,
    formatted: `${snap.localTimeFormatted} (${snap.timezone}, ${snap.utcOffset})`,
    weekday: snap.weekday,
    utcOffset: snap.utcOffset,
  };
}

export function nextOccurrence(
  schedule: TriggerTimeSchedule,
  from: Date = new Date(),
): string | null {
  const tz = schedule.timezone || getCurrentTimezone();
  if (schedule.kind === "once" && schedule.onceAtUtc) {
    return schedule.onceAtUtc;
  }
  if (schedule.kind === "interval_hours" && schedule.intervalHours) {
    return new Date(from.getTime() + schedule.intervalHours * 3600_000).toISOString();
  }
  if (schedule.localTime) {
    const [hh, mm] = schedule.localTime.split(":").map((x) => parseInt(x, 10));
    if (schedule.kind === "weekly" && schedule.weekday != null) {
      return nextWeeklyOccurrence(from, tz, schedule.weekday, hh, mm).toISOString();
    }
    return nextDailyOccurrence(from, tz, hh, mm).toISOString();
  }
  return null;
}

export function defaultNextCheckAtIso(
  type: "price" | "time" | "yield" | "portfolio",
  schedule?: TriggerTimeSchedule | null,
): string {
  if (type === "price") {
    return new Date(Date.now() + 60_000).toISOString();
  }
  if (schedule) {
    const next = nextOccurrence(schedule);
    if (next) return next;
  }
  return new Date(Date.now() + 60_000).toISOString();
}

export function parseUserSchedule(text: string, timezone?: string) {
  const tz = timezone ?? getCurrentTimezone();
  const result = parseNaturalSchedule(text, tz);
  if (result.ok === false) {
    return { ok: false as const, missing: result.missing };
  }
  return { ok: true as const, schedule: result.schedule };
}

export function computeNextScheduleUtcIso(
  schedule: TriggerTimeSchedule,
  from: Date = new Date(),
): string | null {
  return nextOccurrence(schedule, from);
}
