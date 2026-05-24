import type { TriggerTimeSchedule } from "../../packages/core/triggers/triggers.types";
import type { ParsedNaturalSchedule, RecurrenceSchedule } from "./time.types";
import {
  convertLocalPartsToUtc,
  getZonedParts,
  isPastDate,
  pad2,
  to24Hour,
} from "./time-utils";

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function formatDisplayQuick(date: Date, timezone: string): string {
  try {
    const datePart = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
    }).format(date);
    const timePart = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
    return `${datePart} • ${timePart} • ${timezone}`;
  } catch {
    return date.toISOString();
  }
}

function okSchedule(
  schedule: TriggerTimeSchedule,
  recurrence: RecurrenceSchedule,
  nextUtc: Date,
  timezone: string,
  isRecurring: boolean,
): ParsedNaturalSchedule {
  if (isPastDate(nextUtc)) {
    return { ok: false, missing: ["a future date and time (that time is already in the past)"] };
  }
  return {
    ok: true,
    schedule,
    recurrence,
    displayLabel: formatDisplayQuick(nextUtc, timezone),
    nextUtcIso: nextUtc.toISOString(),
    isRecurring,
  };
}

function parseHourMinute(h: string, m: string | undefined, ap?: string): { hour: number; minute: number } {
  const hour = to24Hour(parseInt(h, 10), ap);
  const minute = m ? parseInt(m, 10) : 0;
  return { hour, minute };
}

/**
 * Deterministic natural-language schedule parsing (no LLM).
 */
export function parseNaturalSchedule(
  text: string,
  timezone: string,
  now: Date = new Date(),
): ParsedNaturalSchedule {
  const t = text.trim();
  const lower = t.toLowerCase();

  if (/\byesterday\b/i.test(lower)) {
    return { ok: false, missing: ["a future time — yesterday has already passed"] };
  }

  const relMin = lower.match(/\bin\s+(\d+)\s*minutes?\b/);
  if (relMin) {
    const mins = parseInt(relMin[1], 10);
    if (mins > 0 && mins <= 60 * 24 * 30) {
      const next = new Date(now.getTime() + mins * 60_000);
      const schedule: TriggerTimeSchedule = { kind: "once", onceAtUtc: next.toISOString(), timezone };
      const recurrence: RecurrenceSchedule = { type: "once", timezone, onceAtUtc: next.toISOString() };
      return okSchedule(schedule, recurrence, next, timezone, false);
    }
  }

  const relHr = lower.match(/\bin\s+(\d+)\s*hours?\b/);
  if (relHr) {
    const hrs = parseInt(relHr[1], 10);
    if (hrs > 0 && hrs <= 24 * 30) {
      const next = new Date(now.getTime() + hrs * 3600_000);
      const schedule: TriggerTimeSchedule = { kind: "once", onceAtUtc: next.toISOString(), timezone };
      const recurrence: RecurrenceSchedule = { type: "once", timezone, onceAtUtc: next.toISOString() };
      return okSchedule(schedule, recurrence, next, timezone, false);
    }
  }

  const relDay = lower.match(/\bin\s+(\d+)\s*days?\b/);
  if (relDay) {
    const days = parseInt(relDay[1], 10);
    if (days > 0 && days <= 365) {
      const parts = getZonedParts(now, timezone);
      const next = convertLocalPartsToUtc(
        parts.year,
        parts.month,
        parts.day + days,
        parts.hour,
        parts.minute,
        timezone,
      );
      const schedule: TriggerTimeSchedule = { kind: "once", onceAtUtc: next.toISOString(), timezone };
      const recurrence: RecurrenceSchedule = { type: "once", timezone, onceAtUtc: next.toISOString() };
      return okSchedule(schedule, recurrence, next, timezone, false);
    }
  }

  const interval = lower.match(/\bevery\s+(\d+)\s*hours?\b/);
  if (interval) {
    const hours = parseInt(interval[1], 10);
    if (hours > 0 && hours <= 168) {
      const next = new Date(now.getTime() + hours * 3600_000);
      const schedule: TriggerTimeSchedule = {
        kind: "interval_hours",
        intervalHours: hours,
        timezone,
      };
      const recurrence: RecurrenceSchedule = {
        type: "interval_hours",
        intervalHours: hours,
        timezone,
      };
      return okSchedule(schedule, recurrence, next, timezone, true);
    }
  }

  const daily =
    lower.match(/\b(?:every\s+day|daily|each\s+day)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i) ||
    lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+every\s+day\b/i);
  if (daily) {
    const [, h, m, ap] = daily;
    const { hour, minute } = parseHourMinute(h, m, ap);
    const next = nextDailyOccurrence(now, timezone, hour, minute);
    const localTime = `${pad2(hour)}:${pad2(minute)}`;
    const schedule: TriggerTimeSchedule = { kind: "daily", localTime, timezone };
    const recurrence: RecurrenceSchedule = { type: "daily", hour, minute, timezone };
    return okSchedule(schedule, recurrence, next, timezone, true);
  }

  const weekly = lower.match(
    /\b(?:every\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
  );
  if (weekly) {
    const [, day, h, m, ap] = weekly;
    const weekday = WEEKDAY_INDEX[day.toLowerCase()];
    const { hour, minute } = parseHourMinute(h, m, ap);
    const next = nextWeeklyOccurrence(now, timezone, weekday, hour, minute);
    const localTime = `${pad2(hour)}:${pad2(minute)}`;
    const schedule: TriggerTimeSchedule = { kind: "weekly", weekday, localTime, timezone };
    const recurrence: RecurrenceSchedule = { type: "weekly", weekday, hour, minute, timezone };
    return okSchedule(schedule, recurrence, next, timezone, true);
  }

  const atTime = lower.match(/\b(?:at|@)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  const tomorrow = /\btomorrow\b/i.test(lower);
  const tonight = /\b(?:tonight|this\s+evening)\b/i.test(lower);

  if (tomorrow && atTime) {
    const [, h, m, ap] = atTime;
    if (!ap && parseInt(h, 10) <= 12 && !m) {
      return {
        ok: false,
        missing: ["whether you mean AM or PM"],
        needsClarification: "ampm",
        partialHour: parseInt(h, 10),
        partialDateLabel: "tomorrow",
      };
    }
    const { hour, minute } = parseHourMinute(h, m, ap ?? (parseInt(h, 10) < 12 ? "am" : undefined));
    const parts = getZonedParts(now, timezone);
    const next = convertLocalPartsToUtc(parts.year, parts.month, parts.day + 1, hour, minute, timezone);
    const schedule: TriggerTimeSchedule = { kind: "once", onceAtUtc: next.toISOString(), timezone };
    const recurrence: RecurrenceSchedule = {
      type: "once",
      hour,
      minute,
      timezone,
      onceAtUtc: next.toISOString(),
    };
    return okSchedule(schedule, recurrence, next, timezone, false);
  }

  if (tomorrow && /\bnoon\b/i.test(lower)) {
    const parts = getZonedParts(now, timezone);
    const next = convertLocalPartsToUtc(parts.year, parts.month, parts.day + 1, 12, 0, timezone);
    const schedule: TriggerTimeSchedule = { kind: "once", onceAtUtc: next.toISOString(), timezone };
    const recurrence: RecurrenceSchedule = { type: "once", hour: 12, minute: 0, timezone, onceAtUtc: next.toISOString() };
    return okSchedule(schedule, recurrence, next, timezone, false);
  }

  if (tomorrow && /\bmorning\b/i.test(lower)) {
    const parts = getZonedParts(now, timezone);
    const next = convertLocalPartsToUtc(parts.year, parts.month, parts.day + 1, 9, 0, timezone);
    const schedule: TriggerTimeSchedule = { kind: "once", onceAtUtc: next.toISOString(), timezone };
    const recurrence: RecurrenceSchedule = { type: "once", hour: 9, minute: 0, timezone, onceAtUtc: next.toISOString() };
    return okSchedule(schedule, recurrence, next, timezone, false);
  }

  if (atTime && !tomorrow) {
    const [, h, m, ap] = atTime;
    if (!ap && parseInt(h, 10) <= 12 && parseInt(h, 10) >= 1 && !m) {
      return {
        ok: false,
        missing: ["whether you mean AM or PM"],
        needsClarification: "ampm",
        partialHour: parseInt(h, 10),
        partialDateLabel: "today",
      };
    }
    const { hour, minute } = parseHourMinute(h, m, ap);
    const next = nextDailyOccurrence(now, timezone, hour, minute);
    const schedule: TriggerTimeSchedule = { kind: "once", onceAtUtc: next.toISOString(), timezone };
    const recurrence: RecurrenceSchedule = {
      type: "once",
      hour,
      minute,
      timezone,
      onceAtUtc: next.toISOString(),
    };
    return okSchedule(schedule, recurrence, next, timezone, false);
  }

  if (tonight) {
    const parts = getZonedParts(now, timezone);
    const next = convertLocalPartsToUtc(parts.year, parts.month, parts.day, 20, 0, timezone);
    if (isPastDate(next)) {
      const nextDay = convertLocalPartsToUtc(parts.year, parts.month, parts.day + 1, 20, 0, timezone);
      const schedule: TriggerTimeSchedule = { kind: "once", onceAtUtc: nextDay.toISOString(), timezone };
      const recurrence: RecurrenceSchedule = {
        type: "once",
        hour: 20,
        minute: 0,
        timezone,
        onceAtUtc: nextDay.toISOString(),
      };
      return okSchedule(schedule, recurrence, nextDay, timezone, false);
    }
    const schedule: TriggerTimeSchedule = { kind: "once", onceAtUtc: next.toISOString(), timezone };
    const recurrence: RecurrenceSchedule = { type: "once", hour: 20, minute: 0, timezone, onceAtUtc: next.toISOString() };
    return okSchedule(schedule, recurrence, next, timezone, false);
  }

  const collectDaily = lower.match(
    /\b(?:collect|harvest)\s+(?:my\s+)?(?:yield|rewards?)\s+(?:every\s+day|daily)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
  );
  if (collectDaily) {
    const [, h, m, ap] = collectDaily;
    const { hour, minute } = parseHourMinute(h, m, ap);
    const next = nextDailyOccurrence(now, timezone, hour, minute);
    const localTime = `${pad2(hour)}:${pad2(minute)}`;
    const schedule: TriggerTimeSchedule = { kind: "daily", localTime, timezone };
    const recurrence: RecurrenceSchedule = { type: "daily", hour, minute, timezone };
    return okSchedule(schedule, recurrence, next, timezone, true);
  }

  return { ok: false, missing: ["when to run (e.g. in 10 minutes, at 6 AM, or every day at 9 AM)"] };
}

export function nextDailyOccurrence(now: Date, timezone: string, hour: number, minute: number): Date {
  const parts = getZonedParts(now, timezone);
  const candidate = convertLocalPartsToUtc(parts.year, parts.month, parts.day, hour, minute, timezone);
  if (!isPastDate(candidate)) return candidate;
  return convertLocalPartsToUtc(parts.year, parts.month, parts.day + 1, hour, minute, timezone);
}

export function nextWeeklyOccurrence(
  now: Date,
  timezone: string,
  weekday: number,
  hour: number,
  minute: number,
): Date {
  const parts = getZonedParts(now, timezone);
  let day = parts.day;
  let delta = weekday - parts.weekday;
  if (delta < 0) delta += 7;
  if (delta === 0) {
    const candidate = convertLocalPartsToUtc(parts.year, parts.month, day, hour, minute, timezone);
    if (!isPastDate(candidate)) return candidate;
    delta = 7;
  }
  day += delta;
  return convertLocalPartsToUtc(parts.year, parts.month, day, hour, minute, timezone);
}

/** Strip schedule phrases from action text for swap parsing. */
export function stripSchedulePhrases(text: string): string {
  return text
    .replace(/\bin\s+\d+\s*(?:minutes?|hours?|days?)\b/gi, "")
    .replace(/\b(?:at|@)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, "")
    .replace(/\btomorrow(?:\s+at\s+noon|\s+morning|\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\b/gi, "")
    .replace(/\b(?:tonight|this\s+evening)\b/gi, "")
    .replace(/\bevery\s+(?:day|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

