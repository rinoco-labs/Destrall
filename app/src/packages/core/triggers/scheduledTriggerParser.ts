import { expandUserTokenAlias } from "../../../services/tokens/tokenAliases.ts";
import { parseNaturalSchedule, stripSchedulePhrases } from "../../../services/time/schedule-parser.ts";

function getCurrentTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
import type { TriggerAction, TriggerDraft } from "./triggers.types.ts";
import type { TriggerParseResult } from "./triggerParser.ts";

const HAS_SCHEDULE_RE =
  /\b(?:in\s+\d+\s*(?:minutes?|hours?|days?)|tomorrow|tonight|every\s+(?:day|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d+\s*hours?)|daily|weekly|monthly|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|@)\b/i;

const SWAP_INTO_RE =
  /\b(?:sell|swap|trade|convert)\s+([\d.,]+%?)\s+(?:of\s+my\s+)?(\w+)\s+(?:into|to|for)\s+(\w+)\b/i;
const AT_TIME_SWAP_RE =
  /\b(?:at|@)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+(?:sell|swap|trade)\s+([\d.,]+%?)\s+(\w+)\s+(?:into|to|for)\s+(\w+)\b/i;
const SWAP_WITH_SCHEDULE_TAIL_RE =
  /\b(?:sell|swap|trade|convert)\s+([\d.,]+%?)\s+(?:of\s+my\s+)?(\w+)\s+(?:into|to|for)\s+(\w+)\s+(.+)$/i;
const SELL_AT_TIME_RE =
  /\b(?:sell|swap|trade|convert)\s+([\d.,]+%?)\s+(?:of\s+my\s+)?(\w+)\s+(?:at|@)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
const DEPOSIT_YIELD_RE =
  /\b(?:deposit|put|supply)\s+([\d.,]+)\s+(\w+)\s+(?:into|to|in)\s+(?:yield|savings|navi)\b/i;
const WITHDRAW_YIELD_RE =
  /\b(?:withdraw|take\s+(?:out|my))\s+(?:my\s+)?([\d.,]+%?)?\s*(\w+)\s+from\s+(?:yield|savings|navi)\b/i;
const REBALANCE_IN_RE = /\b(?:in\s+\d+\s*(?:minutes?|hours?|days?)|tomorrow|at\s+\d).+\brebalance\b/i;

function defaultStableOut(asset: string): string {
  return asset.toUpperCase() === "USDC" ? "SUI" : "USDC";
}

function buildScheduledSwapDraft(
  params: {
    from: string;
    to: string;
    amount: string;
    scheduleText: string;
    fullText: string;
  },
  timezone: string,
): TriggerParseResult {
  const sched = parseNaturalSchedule(params.scheduleText || params.fullText, timezone);
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
    slippageBps: 100,
  };

  return { ok: true, draft };
}

function buildScheduledSellDraft(
  params: {
    from: string;
    amount: string;
    scheduleText: string;
    fullText: string;
    toToken?: string;
  },
  timezone: string,
): TriggerParseResult {
  const to = params.toToken ?? defaultStableOut(params.from);
  return buildScheduledSwapDraft(
    {
      from: params.from,
      to,
      amount: params.amount,
      scheduleText: params.scheduleText,
      fullText: params.fullText,
    },
    timezone,
  );
}

function buildScheduledYieldDepositDraft(
  params: {
    asset: string;
    amount: string;
    scheduleText: string;
    fullText: string;
  },
  timezone: string,
): TriggerParseResult {
  const sched = parseNaturalSchedule(params.scheduleText || params.fullText, timezone);
  if (sched.ok === false) {
    if (sched.needsClarification === "ampm") {
      return { ok: false, missing: ["whether you mean AM or PM (e.g. 8 AM or 8 PM)"] };
    }
    return { ok: false, missing: sched.missing };
  }

  const asset = expandUserTokenAlias(params.asset).toUpperCase();
  const draft: TriggerDraft = {
    type: "yield",
    name: `Scheduled Navi deposit ${asset}`,
    description: sched.displayLabel,
    condition: { kind: "scheduled_yield_deposit", atUtc: sched.nextUtcIso },
    action: { type: "yield_deposit", asset, amount: params.amount.replace(/,/g, "") },
    schedule: sched.schedule,
    scheduleDisplay: sched.displayLabel,
    maxExecutions: sched.isRecurring ? 9999 : 1,
  };
  return { ok: true, draft };
}

function buildScheduledYieldWithdrawDraft(
  params: {
    asset: string;
    amount?: string;
    amountKind: "absolute" | "all" | "percentage";
    scheduleText: string;
    fullText: string;
  },
  timezone: string,
): TriggerParseResult {
  const sched = parseNaturalSchedule(params.scheduleText || params.fullText, timezone);
  if (sched.ok === false) {
    if (sched.needsClarification === "ampm") {
      return { ok: false, missing: ["whether you mean AM or PM (e.g. 8 AM or 8 PM)"] };
    }
    return { ok: false, missing: sched.missing };
  }

  const asset = expandUserTokenAlias(params.asset).toUpperCase();
  const draft: TriggerDraft = {
    type: "yield",
    name: `Scheduled Navi withdraw ${asset}`,
    description: sched.displayLabel,
    condition: { kind: "scheduled_yield_withdraw", atUtc: sched.nextUtcIso },
    action: {
      type: "yield_withdraw",
      asset,
      amountKind: params.amountKind,
      amount: params.amount?.replace(/,/g, ""),
    },
    schedule: sched.schedule,
    scheduleDisplay: sched.displayLabel,
    maxExecutions: sched.isRecurring ? 9999 : 1,
  };
  return { ok: true, draft };
}

/**
 * Parse time-scheduled swap / rebalance / yield requests (never immediate execution).
 */
export function parseScheduledTriggerFromText(
  text: string,
  timezoneOverride?: string,
): TriggerParseResult | null {
  const t = text.trim();
  if (!HAS_SCHEDULE_RE.test(t)) return null;
  const timezone = timezoneOverride ?? getCurrentTimezone();

  const atSwap = t.match(AT_TIME_SWAP_RE);
  if (atSwap) {
    const [, h, m, ap, amt, from, to] = atSwap;
    const scheduleText = `at ${h}${m ? `:${m}` : ""}${ap ? ` ${ap}` : ""}`;
    return buildScheduledSwapDraft(
      { from, to, amount: amt, scheduleText, fullText: t },
      timezone,
    );
  }

  const sellAtTime = t.match(SELL_AT_TIME_RE);
  if (sellAtTime) {
    const [, amt, from, h, m, ap] = sellAtTime;
    const scheduleText = `at ${h}${m ? `:${m}` : ""}${ap ? ` ${ap}` : ""}`;
    return buildScheduledSellDraft(
      { from, amount: amt, scheduleText, fullText: t },
      timezone,
    );
  }

  const swapInto = t.match(SWAP_INTO_RE);
  if (swapInto) {
    const [, amt, from, to] = swapInto;
    return buildScheduledSwapDraft(
      { from, to, amount: amt, scheduleText: t, fullText: t },
      timezone,
    );
  }

  const tail = t.match(SWAP_WITH_SCHEDULE_TAIL_RE);
  if (tail) {
    const [, amt, from, to, schedPart] = tail;
    return buildScheduledSwapDraft(
      { from, to, amount: amt, scheduleText: schedPart, fullText: t },
      timezone,
    );
  }

  const depositYield = t.match(DEPOSIT_YIELD_RE);
  if (depositYield) {
    const [, amt, asset] = depositYield;
    return buildScheduledYieldDepositDraft(
      { asset, amount: amt, scheduleText: t, fullText: t },
      timezone,
    );
  }

  const withdrawYield = t.match(WITHDRAW_YIELD_RE);
  if (withdrawYield) {
    const [, maybeAmt, asset] = withdrawYield;
    const amountKind = maybeAmt && /%/.test(maybeAmt) ? "percentage" : maybeAmt ? "absolute" : "all";
    return buildScheduledYieldWithdrawDraft(
      {
        asset,
        amount: maybeAmt || undefined,
        amountKind,
        scheduleText: t,
        fullText: t,
      },
      timezone,
    );
  }

  if (REBALANCE_IN_RE.test(t)) {
    const sched = parseNaturalSchedule(t, timezone);
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
    const sched = parseNaturalSchedule(t, timezone);
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
