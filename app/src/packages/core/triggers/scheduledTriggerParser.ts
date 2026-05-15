import { expandUserTokenAlias } from "../../../services/tokens/swappableTokenRegistry";
import {
  getCurrentTimezone,
  parseNaturalSchedule,
  stripSchedulePhrases,
} from "../../../services/time/time.service";
import type { TriggerAction, TriggerDraft } from "./triggers.types";
import type { TriggerParseResult } from "./triggerParser";

const HAS_SCHEDULE_RE =
  /\b(?:in\s+\d+\s*(?:minutes?|hours?|days?)|tomorrow|tonight|every\s+(?:day|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d+\s*hours?)|daily|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|@)\b/i;

const SWAP_INTO_RE =
  /\b(?:sell|swap|trade|convert)\s+([\d.,]+%?)\s+(?:of\s+my\s+)?(\w+)\s+(?:into|to|for)\s+(\w+)\b/i;
const AT_TIME_SWAP_RE =
  /\b(?:at|@)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+(?:sell|swap|trade)\s+([\d.,]+%?)\s+(\w+)\s+(?:into|to|for)\s+(\w+)\b/i;
const SWAP_WITH_SCHEDULE_TAIL_RE =
  /\b(?:sell|swap|trade|convert)\s+([\d.,]+%?)\s+(?:of\s+my\s+)?(\w+)\s+(?:into|to|for)\s+(\w+)\s+(.+)$/i;
const REBALANCE_IN_RE = /\b(?:in\s+\d+\s*(?:minutes?|hours?|days?)|tomorrow|at\s+\d).+\brebalance\b/i;

function buildScheduledSwapDraft(params: {
  from: string;
  to: string;
  amount: string;
  scheduleText: string;
  fullText: string;
}): TriggerParseResult {
  const tz = getCurrentTimezone();
  const sched = parseNaturalSchedule(params.scheduleText || params.fullText, tz);
  if (sched.ok === false) {
    if (sched.needsClarification === "ampm") {
      return {
        ok: false,
        missing: ["whether you mean AM or PM (e.g. 8 AM or 8 PM)"],
      };
    }
    return { ok: false, missing: sched.missing };
  }

  const fromTok = expandUserTokenAlias(params.from).toUpperCase();
  const toTok = expandUserTokenAlias(params.to).toUpperCase();
  const action: TriggerAction = {
    type: "swap",
    fromToken: fromTok,
    toToken: toTok,
    amount: params.amount.replace(/,/g, ""),
  };

  const draft: TriggerDraft = {
    type: "time",
    name: `Scheduled swap ${fromTok}→${toTok}`,
    description: sched.displayLabel,
    condition: { kind: "scheduled", atUtc: sched.nextUtcIso },
    action,
    schedule: sched.schedule,
    scheduleDisplay: sched.displayLabel,
    maxExecutions: sched.isRecurring ? 9999 : 1,
    slippageBps: 50,
  };

  return { ok: true, draft };
}

/**
 * Parse time-scheduled swap / rebalance requests (never immediate execution).
 */
export function parseScheduledTriggerFromText(text: string): TriggerParseResult | null {
  const t = text.trim();
  if (!HAS_SCHEDULE_RE.test(t)) return null;

  const atSwap = t.match(AT_TIME_SWAP_RE);
  if (atSwap) {
    const [, h, m, ap, amt, from, to] = atSwap;
    const scheduleText = `at ${h}${m ? `:${m}` : ""}${ap ? ` ${ap}` : ""}`;
    return buildScheduledSwapDraft({
      from,
      to,
      amount: amt,
      scheduleText,
      fullText: t,
    });
  }

  const swapInto = t.match(SWAP_INTO_RE);
  if (swapInto) {
    const [, amt, from, to] = swapInto;
    return buildScheduledSwapDraft({
      from,
      to,
      amount: amt,
      scheduleText: t,
      fullText: t,
    });
  }

  const tail = t.match(SWAP_WITH_SCHEDULE_TAIL_RE);
  if (tail) {
    const [, amt, from, to, schedPart] = tail;
    return buildScheduledSwapDraft({
      from,
      to,
      amount: amt,
      scheduleText: schedPart,
      fullText: t,
    });
  }

  if (REBALANCE_IN_RE.test(t)) {
    const sched = parseNaturalSchedule(t, getCurrentTimezone());
    if (sched.ok === false) {
      return { ok: false, missing: sched.missing };
    }
    return {
      ok: true,
      draft: {
        type: "portfolio",
        name: "Scheduled rebalance",
        description: sched.displayLabel,
        condition: { kind: "scheduled_rebalance", atUtc: sched.nextUtcIso },
        action: { type: "swap", fromToken: "SUI", toToken: "USDC", amount: "0" },
        schedule: sched.schedule,
        scheduleDisplay: sched.displayLabel,
        maxExecutions: sched.isRecurring ? 9999 : 1,
      },
    };
  }

  if (/\b(?:collect|harvest)\s+(?:my\s+)?(?:yield|rewards?)\b/i.test(t) && HAS_SCHEDULE_RE.test(t)) {
    const sched = parseNaturalSchedule(t, getCurrentTimezone());
    if (sched.ok === false) {
      return { ok: false, missing: sched.missing };
    }
    return {
      ok: true,
      draft: {
        type: "yield",
        name: "Scheduled yield collection",
        description: sched.displayLabel,
        condition: { kind: "scheduled_yield", atUtc: sched.nextUtcIso },
        action: { type: "yield_collect", mode: "all_pools" },
        schedule: sched.schedule,
        scheduleDisplay: sched.displayLabel,
        maxExecutions: sched.isRecurring ? 9999 : 1,
      },
    };
  }

  return null;
}

export function hasScheduleIntent(text: string): boolean {
  return HAS_SCHEDULE_RE.test(text.trim());
}

export function actionTextWithoutSchedule(text: string): string {
  return stripSchedulePhrases(text);
}
