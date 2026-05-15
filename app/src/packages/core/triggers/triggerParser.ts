import { expandUserTokenAlias } from "../../../services/tokens/swappableTokenRegistry";
import { parseUserSchedule } from "../../../services/time/timeService";
import { parseScheduledTriggerFromText } from "./scheduledTriggerParser";
import type { TriggerAction, TriggerCategory, TriggerDraft, TriggerPriceCondition } from "./triggers.types";

export type TriggerParseResult =
  | { ok: true; draft: TriggerDraft }
  | { ok: false; missing: string[]; partial?: Partial<TriggerDraft> };

const PRICE_ABOVE_RE =
  /\b(?:if\s+)?(\w+)\s+(?:goes?\s+)?(?:above|over|exceeds?|hits?)\s+\$?\s*([\d.,]+)\b/i;
const PRICE_BELOW_RE =
  /\b(?:if\s+)?(\w+)\s+(?:goes?\s+)?(?:below|under|drops?\s+(?:below|under)|falls?\s+below)\s+\$?\s*([\d.,]+)\b/i;
const SELL_IF_ABOVE_RE =
  /\b(?:sell|swap)\s+([\d.,]+)\s+(\w+)\s+(?:if|when)\s+(\w+)\s+(?:goes?\s+)?(?:above|over)\s+\$?\s*([\d.,]+)\b/i;
const BUY_IF_BELOW_RE =
  /\b(?:buy|swap)\s+(?:for\s+)?([\d.,]+)\s+(\w+)\s+(?:if|when)\s+(\w+)\s+(?:goes?\s+)?(?:below|under)\s+\$?\s*([\d.,]+)\b/i;
const COLLECT_YIELD_RE =
  /\b(?:collect|harvest)\s+(?:my\s+)?(?:yield|rewards?)(?:\s+from\s+(?:all\s+)?pools?)?\b/i;
const REBALANCE_SCHEDULE_RE =
  /\b(?:rebalance)\s+(?:my\s+)?(?:portfolio)?\s*(?:every\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|day|daily)?/i;

function defaultStableOut(asset: string): string {
  return asset.toUpperCase() === "USDC" ? "SUI" : "USDC";
}

function buildPriceDraft(params: {
  asset: string;
  operator: TriggerPriceCondition["operator"];
  priceUsd: string;
  action: TriggerAction;
  maxExecutions?: number;
}): TriggerDraft {
  const sym = expandUserTokenAlias(params.asset).toUpperCase();
  return {
    type: "price",
    name: `${params.action.type === "swap" ? params.action.fromToken : sym} trigger`,
    description: `${sym} ${params.operator} $${params.priceUsd}`,
    condition: {
      asset: sym,
      operator: params.operator,
      priceUsd: params.priceUsd,
    },
    action: params.action,
    maxExecutions: params.maxExecutions ?? 1,
    slippageBps: 50,
  };
}

/**
 * Parse natural-language trigger requests into structured drafts (no execution).
 */
export function parseTriggerFromText(text: string): TriggerParseResult {
  const t = text.trim();

  const scheduled = parseScheduledTriggerFromText(t);
  if (scheduled) return scheduled;

  const sellAbove = t.match(SELL_IF_ABOVE_RE);
  if (sellAbove) {
    const [, amt, fromTok, asset, price] = sellAbove;
    const from = expandUserTokenAlias(fromTok).toUpperCase();
    const condAsset = expandUserTokenAlias(asset).toUpperCase();
    return {
      ok: true,
      draft: buildPriceDraft({
        asset: condAsset,
        operator: "above",
        priceUsd: price.replace(/,/g, ""),
        action: {
          type: "swap",
          fromToken: from,
          toToken: defaultStableOut(from),
          amount: amt.replace(/,/g, ""),
        },
      }),
    };
  }

  const buyBelow = t.match(BUY_IF_BELOW_RE);
  if (buyBelow) {
    const [, amt, toTok, asset, price] = buyBelow;
    const to = expandUserTokenAlias(toTok).toUpperCase();
    const condAsset = expandUserTokenAlias(asset).toUpperCase();
    const spend = defaultStableOut(to);
    return {
      ok: true,
      draft: buildPriceDraft({
        asset: condAsset,
        operator: "below",
        priceUsd: price.replace(/,/g, ""),
        action: {
          type: "swap",
          fromToken: spend,
          toToken: to,
          amount: amt.replace(/,/g, ""),
        },
      }),
    };
  }

  const above = t.match(PRICE_ABOVE_RE);
  const below = t.match(PRICE_BELOW_RE);
  const sellAmt = t.match(/\b(?:sell|swap)\s+([\d.,]+)\s+(\w+)\b/i);
  const buyAmt = t.match(/\b(?:buy)\s+([\d.,]+)\s+(\w+)\b/i);

  if (above && sellAmt) {
    const [, asset, price] = above;
    const [, amt, fromTok] = sellAmt;
    const from = expandUserTokenAlias(fromTok).toUpperCase();
    const condAsset = expandUserTokenAlias(asset).toUpperCase();
    return {
      ok: true,
      draft: buildPriceDraft({
        asset: condAsset,
        operator: "above",
        priceUsd: price.replace(/,/g, ""),
        action: {
          type: "swap",
          fromToken: from,
          toToken: defaultStableOut(from),
          amount: amt.replace(/,/g, ""),
        },
      }),
    };
  }

  if (below && buyAmt) {
    const [, asset, price] = below;
    const [, amt, toTok] = buyAmt;
    const to = expandUserTokenAlias(toTok).toUpperCase();
    const condAsset = expandUserTokenAlias(asset).toUpperCase();
    return {
      ok: true,
      draft: buildPriceDraft({
        asset: condAsset,
        operator: "below",
        priceUsd: price.replace(/,/g, ""),
        action: {
          type: "swap",
          fromToken: defaultStableOut(to),
          toToken: to,
          amount: amt.replace(/,/g, ""),
        },
      }),
    };
  }

  if (above || below) {
    const missing: string[] = [];
    if (!sellAmt && !buyAmt) missing.push("action amount (e.g. sell 10 SUI)");
    if (missing.length) {
      return {
        ok: false,
        missing,
        partial: {
          type: "price",
          condition: above
            ? {
                asset: expandUserTokenAlias(above[1]).toUpperCase(),
                operator: "above",
                priceUsd: above[2].replace(/,/g, ""),
              }
            : {
                asset: expandUserTokenAlias(below![1]).toUpperCase(),
                operator: "below",
                priceUsd: below![2].replace(/,/g, ""),
              },
        },
      };
    }
  }

  if (COLLECT_YIELD_RE.test(t) || (/\bevery\s+day\b/i.test(t) && /\b(?:10|9)\s*(?:am|pm)?\b/i.test(t))) {
    const sched = parseUserSchedule(t);
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
    const sched = parseUserSchedule(t);
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
