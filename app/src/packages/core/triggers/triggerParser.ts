import { expandUserTokenAlias } from "../../../services/tokens/tokenAliases.ts";
import { parseNaturalSchedule } from "../../../services/time/schedule-parser.ts";

function getCurrentTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
import { parseScheduledTriggerFromText } from "./scheduledTriggerParser.ts";
import type { TriggerAction, TriggerCategory, TriggerDraft, TriggerPriceCondition } from "./triggers.types.ts";

export type TriggerParseResult =
  | { ok: true; draft: TriggerDraft }
  | { ok: false; missing: string[]; partial?: Partial<TriggerDraft> };

const PRICE_ABOVE_RE =
  /\b(?:if\s+)?(\w+)\s+(?:goes?\s+)?(?:above|over|exceeds?)\s+\$?\s*([\d.,]+)\s*(?:usd|dollars?)?\b/i;
const PRICE_BELOW_RE =
  /\b(?:if\s+)?(\w+)\s+(?:goes?\s+)?(?:below|under)\s+\$?\s*([\d.,]+)\s*(?:usd|dollars?)?\b/i;
const PRICE_DROPS_TO_RE =
  /\b(?:if\s+)?(\w+)\s+(?:drops?\s+to|falls?\s+(?:to|below))\s+\$?\s*([\d.,]+)\s*(?:usd|dollars?)?\b/i;
const PRICE_RISES_RE =
  /\b(?:if\s+)?(\w+)\s+(?:rises?\s+to|goes?\s+above|hits?|reaches?)\s+\$?\s*([\d.,]+)\s*(?:usd|dollars?)?\b/i;
const PRICE_AT_RE =
  /\b(?:when|if)\s+(\w+)\s+is\s+at\s+\$?\s*([\d.,]+)\s*(?:usd|dollars?)?\b/i;
const PRICE_IS_BELOW_RE =
  /\b(?:when|if)\s+(\w+)\s+is\s+below\s+\$?\s*([\d.,]+)\s*(?:usd|dollars?)?\b/i;

const SELL_IF_ABOVE_RE =
  /\b(?:sell|swap)\s+([\d.,]+)\s+(\w+)\s+(?:if|when)\s+(\w+)\s+(?:goes?\s+)?(?:above|over|reaches?|hits?)\s+\$?\s*([\d.,]+)\b/i;
const BUY_IF_BELOW_RE =
  /\b(?:buy|swap)\s+(?:for\s+)?([\d.,]+)\s+(\w+)\s+(?:if|when)\s+(\w+)\s+(?:goes?\s+)?(?:below|under|drops?\s+to)\s+\$?\s*([\d.,]+)\b/i;
const SELL_WHEN_REACHES_RE =
  /\b(?:sell|swap)\s+([\d.,]+)\s+(\w+)\s+(?:when|if)\s+(\w+)\s+(?:reaches?|hits?)\s+\$?\s*([\d.,]+)\b/i;
const BUY_WORTH_WHEN_RE =
  /\bbuy\s+([\d.,]+)\s+(\w+)\s+worth\s+of\s+(\w+)\s+when\s+(\w+)\s+(?:drops?\s+to|falls?\s+below|is\s+below|goes?\s+below)\s+\$?\s*([\d.,]+)\b/i;
const WHEN_AT_SELL_RE =
  /\bwhen\s+(\w+)\s+is\s+at\s+\$?\s*([\d.,]+)\s*(?:usd|dollars?)?\s+(?:sell|swap)\s+([\d.,]+)\s+(\w+)\b/i;
const WHEN_DROPS_BUY_WORTH_RE =
  /\bwhen\s+(\w+)\s+(?:drops?\s+to|falls?\s+below)\s+\$?\s*([\d.,]+)\s*(?:usd|dollars?)?\s+buy\s+([\d.,]+)\s+(\w+)\s+worth\s+of\s+(\w+)\b/i;
const WHEN_ABOVE_SELL_RE =
  /\bwhen\s+(\w+)\s+(?:goes?\s+above|rises?\s+to|hits?|reaches?)\s+\$?\s*([\d.,]+)\s*(?:usd|dollars?)?\s+(?:sell|swap)\s+([\d.,]+)\s+(\w+)\b/i;
const BUY_WHEN_BELOW_RE =
  /\bbuy\s+(\w+)\s+when\s+(\w+)\s+is\s+below\s+\$?\s*([\d.,]+)\b/i;

const COLLECT_YIELD_RE =
  /\b(?:collect|harvest)\s+(?:my\s+)?(?:yield|rewards?)(?:\s+from\s+(?:all\s+)?pools?)?\b/i;
const REBALANCE_SCHEDULE_RE =
  /\b(?:rebalance)\s+(?:my\s+)?(?:portfolio)?\s*(?:every\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|day|daily)?/i;

const SELL_AMOUNT_RE = /\b(?:sell|swap)\s+([\d.,]+)\s+(\w+)\b/i;
const BUY_WORTH_RE = /\bbuy\s+([\d.,]+)\s+(\w+)\s+worth\s+of\s+(\w+)\b/i;
const BUY_AMOUNT_RE = /\bbuy\s+([\d.,]+)\s+(\w+)\b/i;

export const DEFAULT_SELL_TARGET = "USDC";

function defaultStableOut(asset: string): string {
  return asset.toUpperCase() === "USDC" ? "SUI" : DEFAULT_SELL_TARGET;
}

function normalizeAmount(raw: string): string {
  return raw.replace(/,/g, "");
}

function normalizeSymbol(raw: string): string {
  return expandUserTokenAlias(raw).toUpperCase();
}

function buildPriceDraft(params: {
  asset: string;
  operator: TriggerPriceCondition["operator"];
  priceUsd: string;
  action: TriggerAction;
  maxExecutions?: number;
  needsAtResolution?: boolean;
}): TriggerDraft {
  const sym = normalizeSymbol(params.asset);
  const condition: TriggerPriceCondition = {
    asset: sym,
    operator: params.operator,
    priceUsd: normalizeAmount(params.priceUsd),
  };
  if (params.needsAtResolution) {
    condition.needsAtResolution = true;
  }
  return {
    type: "price",
    name: `${params.action.type === "swap" ? (params.action as { fromToken: string }).fromToken : sym} trigger`,
    description: `${sym} ${params.operator} $${condition.priceUsd}`,
    condition,
    action: params.action,
    maxExecutions: params.maxExecutions ?? 1,
    slippageBps: 50,
  };
}

function buildSwapAction(params: {
  fromToken: string;
  toToken: string;
  amount: string;
}): TriggerAction {
  return {
    type: "swap",
    fromToken: normalizeSymbol(params.fromToken),
    toToken: normalizeSymbol(params.toToken),
    amount: normalizeAmount(params.amount),
  };
}

type ParsedPriceCond =
  | { asset: string; operator: TriggerPriceCondition["operator"]; priceUsd: string; needsAtResolution?: boolean }
  | null;

function parsePriceConditionFromText(text: string): ParsedPriceCond {
  const t = text;

  const drops = t.match(PRICE_DROPS_TO_RE);
  if (drops) {
    return { asset: drops[1], operator: "below", priceUsd: drops[2] };
  }

  const isBelow = t.match(PRICE_IS_BELOW_RE);
  if (isBelow) {
    return { asset: isBelow[1], operator: "below", priceUsd: isBelow[2] };
  }

  const below = t.match(PRICE_BELOW_RE);
  if (below) {
    return { asset: below[1], operator: "below", priceUsd: below[2] };
  }

  const rises = t.match(PRICE_RISES_RE);
  if (rises) {
    return { asset: rises[1], operator: "above", priceUsd: rises[2] };
  }

  const above = t.match(PRICE_ABOVE_RE);
  if (above) {
    return { asset: above[1], operator: "above", priceUsd: above[2] };
  }

  const at = t.match(PRICE_AT_RE);
  if (at) {
    return { asset: at[1], operator: "target", priceUsd: at[2], needsAtResolution: true };
  }

  return null;
}

/**
 * Infer above/below for ambiguous "at" price using live quote.
 */
export function resolveAtPriceOperator(params: {
  asset: string;
  priceUsd: string;
  action: TriggerAction;
  currentPriceUsd: number | null;
}): { operator: TriggerPriceCondition["operator"]; error?: string } {
  const threshold = parseFloat(params.priceUsd);
  if (!Number.isFinite(threshold)) {
    return { operator: "target", error: "Invalid price threshold." };
  }

  if (params.currentPriceUsd == null || !Number.isFinite(params.currentPriceUsd)) {
    return {
      operator: "target",
      error: `Should this trigger fire when ${normalizeSymbol(params.asset)} is above or below $${params.priceUsd}?`,
    };
  }

  const current = params.currentPriceUsd;
  if (current > threshold) {
    return { operator: "below" };
  }
  if (current < threshold) {
    return { operator: "above" };
  }
  return { operator: "target" };
}

/**
 * Parse natural-language trigger requests into structured drafts (no execution).
 */
export function parseTriggerFromText(text: string): TriggerParseResult {
  const t = text.trim();

  const scheduled = parseScheduledTriggerFromText(t);
  if (scheduled) return scheduled;

  const whenAtSell = t.match(WHEN_AT_SELL_RE);
  if (whenAtSell) {
    const [, asset, price, amt, fromTok] = whenAtSell;
    const from = normalizeSymbol(fromTok);
    return {
      ok: true,
      draft: buildPriceDraft({
        asset,
        operator: "target",
        priceUsd: price,
        needsAtResolution: true,
        action: buildSwapAction({ fromToken: from, toToken: defaultStableOut(from), amount: amt }),
      }),
    };
  }

  const whenDropsBuyWorth = t.match(WHEN_DROPS_BUY_WORTH_RE);
  if (whenDropsBuyWorth) {
    const [, asset, price, spendAmt, spendTok, receiveTok] = whenDropsBuyWorth;
    return {
      ok: true,
      draft: buildPriceDraft({
        asset,
        operator: "below",
        priceUsd: price,
        action: buildSwapAction({
          fromToken: spendTok,
          toToken: receiveTok,
          amount: spendAmt,
        }),
      }),
    };
  }

  const whenAboveSell = t.match(WHEN_ABOVE_SELL_RE);
  if (whenAboveSell) {
    const [, asset, price, amt, fromTok] = whenAboveSell;
    const from = normalizeSymbol(fromTok);
    return {
      ok: true,
      draft: buildPriceDraft({
        asset,
        operator: "above",
        priceUsd: price,
        action: buildSwapAction({ fromToken: from, toToken: defaultStableOut(from), amount: amt }),
      }),
    };
  }

  const sellAbove = t.match(SELL_IF_ABOVE_RE);
  if (sellAbove) {
    const [, amt, fromTok, asset, price] = sellAbove;
    const from = normalizeSymbol(fromTok);
    return {
      ok: true,
      draft: buildPriceDraft({
        asset,
        operator: "above",
        priceUsd: price,
        action: buildSwapAction({ fromToken: from, toToken: defaultStableOut(from), amount: amt }),
      }),
    };
  }

  const sellReaches = t.match(SELL_WHEN_REACHES_RE);
  if (sellReaches) {
    const [, amt, fromTok, asset, price] = sellReaches;
    const from = normalizeSymbol(fromTok);
    return {
      ok: true,
      draft: buildPriceDraft({
        asset,
        operator: "above",
        priceUsd: price,
        action: buildSwapAction({ fromToken: from, toToken: defaultStableOut(from), amount: amt }),
      }),
    };
  }

  const buyWorthWhen = t.match(BUY_WORTH_WHEN_RE);
  if (buyWorthWhen) {
    const [, spendAmt, spendTok, receiveTok, asset, price] = buyWorthWhen;
    return {
      ok: true,
      draft: buildPriceDraft({
        asset,
        operator: "below",
        priceUsd: price,
        action: buildSwapAction({ fromToken: spendTok, toToken: receiveTok, amount: spendAmt }),
      }),
    };
  }

  const buyBelow = t.match(BUY_IF_BELOW_RE);
  if (buyBelow) {
    const [, amt, toTok, asset, price] = buyBelow;
    const to = normalizeSymbol(toTok);
    return {
      ok: true,
      draft: buildPriceDraft({
        asset,
        operator: "below",
        priceUsd: price,
        action: buildSwapAction({ fromToken: defaultStableOut(to), toToken: to, amount: amt }),
      }),
    };
  }

  const buyWhenBelow = t.match(BUY_WHEN_BELOW_RE);
  if (buyWhenBelow) {
    const [, receiveTok, asset, price] = buyWhenBelow;
    const to = normalizeSymbol(receiveTok);
    return {
      ok: false,
      missing: [`how much to spend (e.g. buy 10 USDC worth of ${to})`],
      partial: {
        type: "price",
        condition: {
          asset: normalizeSymbol(asset),
          operator: "below",
          priceUsd: normalizeAmount(price),
        },
      },
    };
  }

  const priceCond = parsePriceConditionFromText(t);
  const sellAmt = t.match(SELL_AMOUNT_RE);
  const buyWorth = t.match(BUY_WORTH_RE);
  const buyAmt = t.match(BUY_AMOUNT_RE);

  if (priceCond && sellAmt) {
    const [, amt, fromTok] = sellAmt;
    const from = normalizeSymbol(fromTok);
    return {
      ok: true,
      draft: buildPriceDraft({
        asset: priceCond.asset,
        operator: priceCond.operator,
        priceUsd: priceCond.priceUsd,
        needsAtResolution: priceCond.needsAtResolution,
        action: buildSwapAction({ fromToken: from, toToken: defaultStableOut(from), amount: amt }),
      }),
    };
  }

  if (priceCond && buyWorth) {
    const [, spendAmt, spendTok, receiveTok] = buyWorth;
    return {
      ok: true,
      draft: buildPriceDraft({
        asset: priceCond.asset,
        operator: priceCond.operator,
        priceUsd: priceCond.priceUsd,
        needsAtResolution: priceCond.needsAtResolution,
        action: buildSwapAction({ fromToken: spendTok, toToken: receiveTok, amount: spendAmt }),
      }),
    };
  }

  if (priceCond && buyAmt) {
    const [, amt, toTok] = buyAmt;
    const to = normalizeSymbol(toTok);
    return {
      ok: true,
      draft: buildPriceDraft({
        asset: priceCond.asset,
        operator: priceCond.operator,
        priceUsd: priceCond.priceUsd,
        needsAtResolution: priceCond.needsAtResolution,
        action: buildSwapAction({ fromToken: defaultStableOut(to), toToken: to, amount: amt }),
      }),
    };
  }

  if (priceCond) {
    const missing: string[] = [];
    if (!sellAmt && !buyAmt && !buyWorth) {
      missing.push("action amount (e.g. sell 10 SUI or buy 10 USDC worth of SUI)");
    }
    if (missing.length) {
      return {
        ok: false,
        missing,
        partial: {
          type: "price",
          condition: {
            asset: normalizeSymbol(priceCond.asset),
            operator: priceCond.operator,
            priceUsd: normalizeAmount(priceCond.priceUsd),
            needsAtResolution: priceCond.needsAtResolution,
          },
        },
      };
    }
  }

  if (/\b(?:sell|buy)\s+\w+\s+when\b/i.test(t) && /\b(?:goes?\s+up|goes?\s+down|drops?|rises?)\b/i.test(t)) {
    const missing: string[] = [];
    if (!/\$|\d/.test(t)) missing.push("price threshold (e.g. above $5 or below $0.80)");
    if (!sellAmt && !buyAmt && !buyWorth) missing.push("amount (e.g. sell 10 SUI)");
    if (missing.length) {
      return { ok: false, missing };
    }
  }

  if (COLLECT_YIELD_RE.test(t) || (/\bevery\s+day\b/i.test(t) && /\b(?:10|9)\s*(?:am|pm)?\b/i.test(t))) {
    const sched = parseNaturalSchedule(t, getCurrentTimezone());
    if (sched.ok === false) {
      return { ok: false, missing: sched.missing };
    }
    return {
      ok: true,
      draft: {
        type: "yield",
        name: "Daily yield collection",
        description: "Collect available Navi yield on schedule",
        condition: { kind: "scheduled_yield" },
        action: { type: "yield_collect", mode: "all_pools" },
        schedule: sched.schedule,
        maxExecutions: 9999,
      },
    };
  }

  if (REBALANCE_SCHEDULE_RE.test(t)) {
    const sched = parseNaturalSchedule(t, getCurrentTimezone());
    if (sched.ok === false) {
      return { ok: false, missing: sched.missing };
    }
    return {
      ok: true,
      draft: {
        type: "portfolio",
        name: "Scheduled rebalance",
        description: "Rebalance portfolio on schedule (v1: proposal only — execution limited)",
        condition: { kind: "scheduled_rebalance" },
        action: { type: "swap", fromToken: "SUI", toToken: "USDC", amount: "0" },
        schedule: sched.schedule,
        maxExecutions: 9999,
      },
    };
  }

  if (/\btrigger\b/i.test(t) && /\bsell\b/i.test(t) && !/\$|\d/.test(t)) {
    return {
      ok: false,
      missing: ["trigger price (e.g. above $5)", "amount to sell (e.g. 10 SUI)"],
    };
  }

  return { ok: false, missing: ["trigger condition and action"] };
}

export function isTriggerManagementCommand(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\b(?:show|list)\s+(?:my\s+)?triggers\b/.test(lower) ||
    /\b(?:pause|resume|start|delete|remove)\s+(?:my\s+)?(?:trigger\b|the\s+.+?\s+trigger)/.test(lower)
  );
}

export function parseTriggerManagementCommand(
  text: string,
): { action: "list" } | { action: "pause" | "resume" | "delete"; nameHint: string } | null {
  const lower = text.toLowerCase().trim();
  if (/\b(?:show|list)\s+(?:my\s+)?triggers\b/.test(lower)) {
    return { action: "list" };
  }
  const pause = lower.match(/\b(?:pause)\s+(?:my\s+)?(?:the\s+)?(.+?)\s+trigger\b/);
  if (pause) return { action: "pause", nameHint: pause[1].trim() };
  const resume = lower.match(/\b(?:resume|start)\s+(?:my\s+)?(?:the\s+)?(.+?)\s+trigger\b/);
  if (resume) return { action: "resume", nameHint: resume[1].trim() };
  const del = lower.match(/\b(?:delete|remove)\s+(?:my\s+)?(?:the\s+)?(.+?)\s+trigger\b/);
  if (del) return { action: "delete", nameHint: del[1].trim() };
  return null;
}

export function categoryLabel(type: TriggerCategory): string {
  switch (type) {
    case "price":
      return "Price";
    case "time":
      return "Time";
    case "yield":
      return "Yield";
    case "portfolio":
      return "Portfolio";
    default:
      return type;
  }
}
