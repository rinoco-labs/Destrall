import { priceService } from "../../../services/prices/priceService";
import { getCurrentTime } from "../../../services/time/timeService";
import type {
  TriggerPriceCondition,
  TriggerRecord,
  TriggerTimeSchedule,
} from "./triggers.types";

export type ConditionEvaluation = {
  met: boolean;
  reason: string;
  snapshot: Record<string, unknown>;
};

function parseCondition(record: TriggerRecord): TriggerPriceCondition | Record<string, unknown> {
  return JSON.parse(record.conditionJson) as TriggerPriceCondition | Record<string, unknown>;
}

function parseSchedule(record: TriggerRecord): TriggerTimeSchedule | null {
  if (!record.scheduleJson) return null;
  return JSON.parse(record.scheduleJson) as TriggerTimeSchedule;
}

async function evaluatePriceCondition(cond: TriggerPriceCondition): Promise<ConditionEvaluation> {
  const quote = await priceService.getTokenPriceBySymbol(cond.asset);
  if (!quote) {
    return {
      met: false,
      reason: `No live price for ${cond.asset}`,
      snapshot: { asset: cond.asset, priceAvailable: false },
    };
  }

  const threshold = cond.priceUsd ? parseFloat(cond.priceUsd) : NaN;
  if (!Number.isFinite(threshold)) {
    return { met: false, reason: "Invalid price threshold", snapshot: { quote } };
  }

  let met = false;
  if (cond.operator === "above") met = quote.priceUsd > threshold;
  else if (cond.operator === "below") met = quote.priceUsd < threshold;
  else if (cond.operator === "target") {
    const eps = threshold * 0.002;
    met = Math.abs(quote.priceUsd - threshold) <= eps;
  }

  return {
    met,
    reason: met
      ? `${cond.asset} $${quote.priceUsd.toFixed(4)} met ${cond.operator} $${threshold}`
      : `${cond.asset} $${quote.priceUsd.toFixed(4)} did not meet ${cond.operator} $${threshold}`,
    snapshot: {
      asset: cond.asset,
      operator: cond.operator,
      thresholdUsd: threshold,
      priceUsd: quote.priceUsd,
      source: quote.source,
      fetchedAt: quote.fetchedAt,
    },
  };
}

function isScheduleDue(schedule: TriggerTimeSchedule, lastTriggeredAt: string | null): ConditionEvaluation {
  const now = getCurrentTime();
  const snap: Record<string, unknown> = { schedule, nowIso: now.toISOString() };

  if (schedule.kind === "interval_hours" && schedule.intervalHours) {
    if (!lastTriggeredAt) {
      return { met: true, reason: "Interval trigger due (first run)", snapshot: snap };
    }
    const last = new Date(lastTriggeredAt).getTime();
    const due = now.getTime() - last >= schedule.intervalHours * 3600_000;
    return {
      met: due,
      reason: due ? "Interval elapsed" : "Interval not elapsed",
      snapshot: { ...snap, lastTriggeredAt },
    };
  }

  if (schedule.localTime) {
    const tz = schedule.timezone;
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
    const [th, tm] = schedule.localTime.split(":");
    const matchTime = hour === th.padStart(2, "0") && minute === tm.padStart(2, "0");

    if (schedule.kind === "weekly" && schedule.weekday != null) {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const want = dayNames[schedule.weekday];
      const due = matchTime && weekday.startsWith(want.slice(0, 3));
      if (due && lastTriggeredAt) {
        const last = new Date(lastTriggeredAt);
        if (now.getTime() - last.getTime() < 23 * 3600_000) {
          return { met: false, reason: "Already ran today", snapshot: snap };
        }
      }
      return {
        met: due,
        reason: due ? "Weekly schedule due" : "Weekly schedule not due",
        snapshot: { ...snap, localHour: hour, localMinute: minute, weekday },
      };
    }

    if (schedule.kind === "daily") {
      let due = matchTime;
      if (due && lastTriggeredAt) {
        const last = new Date(lastTriggeredAt);
        if (now.getTime() - last.getTime() < 23 * 3600_000) {
          due = false;
        }
      }
      return {
        met: !!due,
        reason: due ? "Daily schedule due" : "Daily schedule not due",
        snapshot: { ...snap, localHour: hour, localMinute: minute },
      };
    }
  }

  return { met: false, reason: "Schedule not due", snapshot: snap };
}

export async function evaluateTriggerCondition(record: TriggerRecord): Promise<ConditionEvaluation> {
  if (record.type === "price") {
    const cond = parseCondition(record) as TriggerPriceCondition;
    return evaluatePriceCondition(cond);
  }

  if (record.type === "time") {
    const cond = parseCondition(record) as { kind?: string; atUtc?: string };
    if (cond.kind === "scheduled" && cond.atUtc) {
      const due = new Date(cond.atUtc).getTime() <= Date.now() + 15_000;
      return {
        met: due,
        reason: due ? "Scheduled time reached" : "Waiting for scheduled time",
        snapshot: { atUtc: cond.atUtc, now: new Date().toISOString() },
      };
    }
  }

  const schedule = parseSchedule(record);
  if (schedule && (record.type === "time" || record.type === "yield" || record.type === "portfolio")) {
    return isScheduleDue(schedule, record.lastTriggeredAt);
  }

  if (record.type === "yield") {
    return {
      met: true,
      reason: "Yield collection window open",
      snapshot: { kind: "yield_manual_check" },
    };
  }

  return { met: false, reason: "Unsupported condition type", snapshot: { type: record.type } };
}
