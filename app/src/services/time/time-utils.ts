export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function to24Hour(hour12: number, ampm?: string): number {
  if (!ampm) {
    if (hour12 >= 0 && hour12 <= 23) return hour12;
    return hour12;
  }
  const ap = ampm.toLowerCase();
  if (ap === "am") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

export function getZonedParts(date: Date, timezone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const wd = get("weekday");
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour: parseInt(get("hour"), 10),
    minute: parseInt(get("minute"), 10),
    weekday: weekdayNames.findIndex((d) => wd.startsWith(d.slice(0, 3))),
  };
}

export function convertLocalPartsToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 6; i++) {
    const p = getZonedParts(new Date(guess), timezone);
    const targetMin = Date.UTC(year, month - 1, day, hour, minute) / 60000;
    const actualMin = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) / 60000;
    const diffMin = targetMin - actualMin;
    if (diffMin === 0) break;
    guess += diffMin * 60_000;
  }
  return new Date(guess);
}

export function isPastDate(date: Date): boolean {
  return date.getTime() <= Date.now() + 5_000;
}

export function formatCountdown(target: Date, from: Date = new Date()): string | null {
  const ms = target.getTime() - from.getTime();
  if (ms <= 0) return null;
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rm = mins % 60;
  if (hrs < 48) return rm > 0 ? `in ${hrs}h ${rm}m` : `in ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `in ${days}d`;
}

export function getUtcOffsetLabel(timezone: string, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    }).formatToParts(at);
    const off = parts.find((p) => p.type === "timeZoneName")?.value;
    if (off) return off.replace("GMT", "UTC");
  } catch {
    /* fall through */
  }
  return "UTC";
}
