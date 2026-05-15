import type { TriggerRecord, TriggerTimeSchedule } from "../../packages/core/triggers/triggers.types";
import { formatCountdown } from "./time-utils";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function scheduleTimezoneFromRecord(record: TriggerRecord): string {
  let tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  if (!record.scheduleJson) return tz;
  try {
    const s = JSON.parse(record.scheduleJson) as TriggerTimeSchedule;
    if (s.timezone) tz = s.timezone;
  } catch {
    /* keep device tz */
  }
  return tz;
}

export function formatTriggerNextCheckLabel(record: TriggerRecord): string | null {
  if (!record.nextCheckAt) return null;
  const next = new Date(record.nextCheckAt);
  const tz = scheduleTimezoneFromRecord(record);
  try {
    const datePart = new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      month: "short",
      day: "numeric",
    }).format(next);
    const timePart = new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    }).format(next);
    const display = `${datePart} • ${timePart} • ${tz}`;
    const cd = formatCountdown(next);
    return cd ? `${display} (${cd})` : display;
  } catch {
    return next.toLocaleString();
  }
}

export function formatTriggerRecurrenceLabel(record: TriggerRecord): string | null {
  if (!record.scheduleJson) return null;
  try {
    const s = JSON.parse(record.scheduleJson) as TriggerTimeSchedule;
    const tz = s.timezone || scheduleTimezoneFromRecord(record);
    if (s.kind === "once") return "One-time";
    if (s.kind === "interval_hours" && s.intervalHours) {
      return `Every ${s.intervalHours} hour(s)`;
    }
    if (s.kind === "weekly" && s.weekday != null && s.localTime) {
      return `Every ${WEEKDAY_NAMES[s.weekday]} at ${s.localTime} (${tz})`;
    }
    if (s.kind === "daily" && s.localTime) {
      return `Daily at ${s.localTime} (${tz})`;
    }
    return s.kind;
  } catch {
    return null;
  }
}
