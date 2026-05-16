import {
  LIST_SWAPPABLE_TOKENS_ACTION_NAME,
  PREPARE_SEND_ACTION_NAME,
  PREPARE_SWAP_ACTION_NAME,
  LIST_YIELD_POOLS_ACTION_NAME,
  GET_YIELD_POSITIONS_ACTION_NAME,
  PREPARE_YIELD_DEPOSIT_ACTION_NAME,
  PREPARE_YIELD_WITHDRAW_ACTION_NAME,
  PREPARE_REBALANCE_ACTION_NAME,
  CREATE_TRIGGER_ACTION_NAME,
  LIST_TRIGGERS_ACTION_NAME,
  PAUSE_TRIGGER_ACTION_NAME,
  RESUME_TRIGGER_ACTION_NAME,
  DELETE_TRIGGER_ACTION_NAME,
} from "./assistantFunctionSchemas";
import {
  isTriggerManagementCommand,
  parseTriggerFromText,
  parseTriggerManagementCommand,
} from "../packages/core/triggers/triggerParser";
import { hasScheduleIntent } from "../packages/core/triggers/scheduledTriggerParser";
import { parseRebalanceTargets } from "../packages/core/rebalance/rebalancePlanner";
import { isYieldPositionsQuestion } from "./yieldPositionIntent";

export type RoutedAssistantToolCall = {
  namespacedName: string;
  input: Record<string, unknown>;
};

export type SwapUserMessageClass = "ok" | "list_query" | "missing_to" | "missing_amount" | "incomplete";

function normalizeUserText(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

const LIST_TOKENS_RE =
  /\b(what tokens are available to swap|what tokens can i swap|what can i trade|show swappable tokens|show me the tokens i can trade|list aftermath tokens|available tokens to swap|swappable tokens|tokens available to swap)\b/i;

/**
 * Classify swap-related user text for follow-up prompts (no LLM).
 */
export function classifySwapUserMessage(text: string): SwapUserMessageClass {
  const t = normalizeUserText(text);
  const lower = t.toLowerCase();

  if (LIST_TOKENS_RE.test(lower)) {
    return "list_query";
  }

  if (!/\b(?:swap|trade|convert)\b/i.test(lower)) {
    return "ok";
  }

  const full = /\b(?:swap|convert|trade)\s+([\d.,]+)\s+(\w+)\s+(?:to|for|into)\s+(\w+)\b/i.test(
    t,
  );

  if (full) {
    return "ok";
  }

  if (/\btrade\s+\w+\s+for\s+\w+\b/i.test(t) && !/\btrade\s+[\d.,]+\s+\w+\s+for\s+/i.test(t)) {
    return "missing_amount";
  }

  if (
    /\b(?:swap|convert|trade)\s+[\d.,]+\s+\w+\s*$/i.test(t) &&
    !/\b(?:to|for|into)\s+\w+/i.test(t)
  ) {
    return "missing_to";
  }

  return "incomplete";
}

/**
 * Deterministic planner: maps natural phrasing → package tool args.
 * When no pattern matches, returns null (caller may still run the LLM with tool schemas only).
 */
export function tryRouteAssistantToolCall(userText: string): RoutedAssistantToolCall | null {
  const text = normalizeUserText(userText);
  const lower = text.toLowerCase();

  if (/\brebalance\b/i.test(lower) && /\d+\s*%/.test(lower)) {
    const targets = parseRebalanceTargets(text);
    if (targets) {
      return { namespacedName: PREPARE_REBALANCE_ACTION_NAME, input: { distributionText: text } };
    }
  }

  if (isYieldPositionsQuestion(lower)) {
    const input: Record<string, unknown> = {};
    const asset = text.match(/\b(?:for|only|in)\s+(\w{2,10})\b/i)?.[1];
    if (asset && !/^(the|a|an|me|my|all|on|in|savings?|yield|navi)$/i.test(asset)) {
      input.asset = asset.toUpperCase() === "SUI" ? "SUI" : asset;
    }
    return { namespacedName: GET_YIELD_POSITIONS_ACTION_NAME, input };
  }

  if (isTriggerManagementCommand(text)) {
    const mgmt = parseTriggerManagementCommand(text);
    if (mgmt?.action === "list") {
      return { namespacedName: LIST_TRIGGERS_ACTION_NAME, input: {} };
    }
    if (mgmt?.action === "pause") {
      return { namespacedName: PAUSE_TRIGGER_ACTION_NAME, input: { nameHint: mgmt.nameHint } };
    }
    if (mgmt?.action === "resume") {
      return { namespacedName: RESUME_TRIGGER_ACTION_NAME, input: { nameHint: mgmt.nameHint } };
    }
    if (mgmt?.action === "delete") {
      return { namespacedName: DELETE_TRIGGER_ACTION_NAME, input: { nameHint: mgmt.nameHint } };
    }
  }

  if (
    hasScheduleIntent(text) ||
    (/\b(?:if|when)\b/i.test(text) &&
      (/\b(?:above|below|goes?\s+(?:up|down)|price|trigger)\b/i.test(lower) ||
        /\b(?:every\s+day|daily|collect\s+(?:my\s+)?yield)\b/i.test(lower))) ||
    /\b(?:create|set\s+up|make)\s+(?:a\s+)?trigger\b/i.test(lower)
  ) {
    const parsed = parseTriggerFromText(text);
    if (parsed.ok) {
      return { namespacedName: CREATE_TRIGGER_ACTION_NAME, input: { naturalLanguage: text } };
    }
  }

  const swapTrade = text.match(
    /\b(?:swap|convert|trade)\s+([\d.,]+)\s+(\w+)\s+(?:to|for|into)\s+(\w+)\b/i,
  );
  if (swapTrade && !hasScheduleIntent(text)) {
    const [, amt, from, to] = swapTrade;
    return {
      namespacedName: PREPARE_SWAP_ACTION_NAME,
      input: { fromToken: from, toToken: to, amount: amt },
    };
  }

  const sendTo = text.match(/\b(?:send|transfer)\s+([\d.,]+)\s+(\w+)\s+to\s+(.+)/i);
  if (sendTo) {
    const [, amt, sym, destRaw] = sendTo;
    const dest = destRaw.trim().replace(/[.,!?;:]+$/, "");
    return {
      namespacedName: PREPARE_SEND_ACTION_NAME,
      input: { token: sym, amount: amt, recipient: dest },
    };
  }

  const payAmountTo = text.match(/\bpay\s+([\d.,]+)\s+(\w+)\s+to\s+(.+)/i);
  if (payAmountTo) {
    const [, amt, sym, destRaw] = payAmountTo;
    const dest = destRaw.trim().replace(/[.,!?;:]+$/, "");
    return {
      namespacedName: PREPARE_SEND_ACTION_NAME,
      input: { token: sym, amount: amt, recipient: dest },
    };
  }

  const payNameAmount = text.match(/\bpay\s+(.+?)\s+([\d.,]+)\s+(\w+)\b(?:\s+to\s+(.+))?/i);
  if (payNameAmount) {
    const [, name, amt, sym, maybeTo] = payNameAmount;
    const recipient = (maybeTo ?? name).trim().replace(/[.,!?;:]+$/, "");
    return {
      namespacedName: PREPARE_SEND_ACTION_NAME,
      input: { token: sym, amount: amt, recipient },
    };
  }

  const otherWallet = text.match(
    /\b(?:send|transfer|pay)\s+([\d.,]+)\s+(\w+)\s+to\s+my\s+other\s+(?:wallet|account)(?:\s+(.+))?$/i,
  );
  if (otherWallet) {
    const [, amt, sym, hint] = otherWallet;
    const h = (hint ?? "").trim();
    const recipient = h ? `__OTHER_ACCOUNT__:${h}` : "__OTHER_ACCOUNT__:";
    return {
      namespacedName: PREPARE_SEND_ACTION_NAME,
      input: { token: sym, amount: amt, recipient },
    };
  }

  if (LIST_TOKENS_RE.test(lower)) {
    const q =
      text.match(/\b(?:for|matching|like|named)\s+["']?([\w.]+)["']?$/i)?.[1] ??
      text.match(/\babout\s+(\w+)\s+tokens?\b/i)?.[1];
    return {
      namespacedName: LIST_SWAPPABLE_TOKENS_ACTION_NAME,
      input: q ? { query: q } : {},
    };
  }

  if (
    /\b(best\s+yield|where\s+should\s+i\s+put|where\s+to\s+put\s+funds?\s+for\s+yield|safest\s+yield|max(?:imum)?\s+yield|maxim(?:ize|ise)\s+(?:my\s+)?yield)\b/i.test(
      lower,
    )
  ) {
    const input: Record<string, string> = { sortBy: "risk" };
    if (/\bconservative|stablecoin|low\s+risk|safe\b/i.test(lower)) input.riskProfile = "conservative";
    if (/\baggressive|degen|high\s+risk|max\s+yield\b/i.test(lower)) input.riskProfile = "aggressive";
    return { namespacedName: LIST_YIELD_POOLS_ACTION_NAME, input };
  }

  /** Navi / yield pool discovery (must stay ahead of generic “navi” fallback). */
  const asksYieldPools =
    /\b(what\s+yield\s+pools|yield\s+pools\s+available|available\s+yield\s+pools|available\s+yield\s+options?|what\s+are\s+the\s+available\s+yield|what\s+yield\s+(?:options?|pools|opportunities)\s+(?:are\s+)?(?:available|on\s+navi)|what\s+yield\s+is\s+available|show\s+(?:me\s+)?(?:available\s+)?yield|list\s+(?:me\s+)?(?:available\s+)?yield|yield\s+options?\s+on\s+navi|yield\s+on\s+navi|show\s+(?:me\s+)?(?:the\s+)?navi\s+pools?|navi\s+pools?|navi\s+yield|yield\s+from\s+navi|navi\s+(?:lending|lend|supply|apy)|what\s+apys?\s+(?:on\s+)?navi|what\s+pools?\s+(?:on\s+)?navi|what\s+apy\s+can\s+i\s+get|apy\s+can\s+i\s+get|how\s+much\s+apy|navi\s+protocol\s+yield)\b/i.test(
      lower,
    ) ||
    (/\bnavi\b/i.test(lower) &&
      /\b(yield|pool|pools|apy|lend|lending|supply|deposit\s+rate|savings|earn)\b/i.test(lower) &&
      !/\b(?:my\s+)?(?:positions?|postions|holding|holdings|balance\s+in|supplied|withdraw|take\s+out)\b/i.test(lower));

  if (asksYieldPools) {
    const input: Record<string, unknown> = {};
    const asset = text.match(/\b(?:for|on|about)\s+(\w{2,10})\s*(?:pool|yield|navi)?\b/i)?.[1];
    if (asset && !/^(the|a|an|me|my|all|any|some)$/i.test(asset)) {
      input.asset = asset.toUpperCase() === "SUI" ? "SUI" : asset;
    }
    if (/\b(sort|order)\b.*\b(tvl|size|liquidity)\b/i.test(lower)) input.sortBy = "tvl";
    else if (/\b(sort|order)\b.*\b(risk|safe|conservative)\b/i.test(lower)) input.sortBy = "risk";
    else if (/\b(sort|order)\b.*\bapy\b/i.test(lower)) input.sortBy = "apy";
    return { namespacedName: LIST_YIELD_POOLS_ACTION_NAME, input };
  }

  const depPct = text.match(
    /\b(?:deposit|put|supply)\s+([\d.]+%)\s+of\s+my\s+(\w+)\s+(?:into|to|in)\s+navi\b/i,
  );
  if (depPct) {
    const [, pct, tok] = depPct;
    return {
      namespacedName: PREPARE_YIELD_DEPOSIT_ACTION_NAME,
      input: { asset: tok, amount: pct, amountKind: "percentage" },
    };
  }

  const depAmt = text.match(
    /\b(?:deposit|put|supply)\s+([\d.,]+)\s+(\w+)\s+(?:into|to|in)\s+navi\b/i,
  );
  if (depAmt) {
    const [, amt, tok] = depAmt;
    return {
      namespacedName: PREPARE_YIELD_DEPOSIT_ACTION_NAME,
      input: { asset: tok, amount: amt, amountKind: "absolute" },
    };
  }

  const wdAll = text.match(/\bwithdraw\s+all\s+(?:my\s+)?(\w+)\s+(?:from|out\s+of)\s+navi\b/i);
  if (wdAll) {
    const [, tok] = wdAll;
    return {
      namespacedName: PREPARE_YIELD_WITHDRAW_ACTION_NAME,
      input: { asset: tok, amountKind: "all" },
    };
  }

  const wdInterest = /\bwithdraw\s+(?:my\s+)?interest\b/i.test(lower);
  if (wdInterest) {
    const m = text.match(/\b(?:from|on|for)\s+(\w+)\s+navi\b/i);
    const tok = m?.[1];
    if (!tok) {
      return null;
    }
    return {
      namespacedName: PREPARE_YIELD_WITHDRAW_ACTION_NAME,
      input: { asset: tok, amountKind: "interest" },
    };
  }

  const wdAmt = text.match(/\bwithdraw\s+([\d.,]+)\s+(\w+)\s+(?:from|out\s+of)\s+navi\b/i);
  if (wdAmt) {
    const [, amt, tok] = wdAmt;
    return {
      namespacedName: PREPARE_YIELD_WITHDRAW_ACTION_NAME,
      input: { asset: tok, amount: amt, amountKind: "absolute" },
    };
  }

  return null;
}

/**
 * True when the user is asking about swapping but did not give amount + both tokens.
 */
export function isIncompleteSwapAsk(userText: string): boolean {
  const c = classifySwapUserMessage(userText);
  return c !== "ok" && c !== "list_query";
}
