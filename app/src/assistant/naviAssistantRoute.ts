import {
  GET_YIELD_POSITIONS_ACTION_NAME,
  LIST_YIELD_POOLS_ACTION_NAME,
  PREPARE_YIELD_DEPOSIT_ACTION_NAME,
  PREPARE_YIELD_WITHDRAW_ACTION_NAME,
} from "./assistantFunctionSchemas.ts";
import { isNaviAvailablePoolsQuestion } from "./naviIntentVocabulary.ts";
import { isYieldPositionsQuestion } from "./yieldPositionIntent.ts";

export type NaviAssistantRoute = {
  namespacedName: string;
  input: Record<string, unknown>;
  category: "positions" | "pools" | "deposit" | "withdraw";
};

const YIELD_DEST_SKIP = /^(the|a|an|me|my|all|on|in|savings?|yield|navi|earn(?:ing)?|lending|supply)$/i;

const YIELD_DEST =
  "(?:yield|savings?|navi|earn(?:ing)?|lending|supply|passive\\s+income)";

function normalizeUserText(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

export function resolveNaviAssistantRoute(userText: string): NaviAssistantRoute | null {
  const text = normalizeUserText(userText);
  const lower = text.toLowerCase();

  if (isYieldPositionsQuestion(lower)) {
    const input: Record<string, unknown> = {};
    const asset = text.match(/\b(?:for|only|in)\s+(\w{2,10})\b/i)?.[1];
    if (asset && !YIELD_DEST_SKIP.test(asset)) {
      input.asset = asset.toUpperCase() === "SUI" ? "SUI" : asset;
    }
    return { namespacedName: GET_YIELD_POSITIONS_ACTION_NAME, input, category: "positions" };
  }

  if (isNaviAvailablePoolsQuestion(lower)) {
    const input: Record<string, unknown> = {};
    const asset = text.match(/\b(?:for|on|about)\s+(\w{2,10})\s*(?:pool|yield|navi|savings)?\b/i)?.[1];
    if (asset && !/^(the|a|an|me|my|all|any|some)$/i.test(asset)) {
      input.asset = asset.toUpperCase() === "SUI" ? "SUI" : asset;
    }
    if (/\b(sort|order)\b.*\b(tvl|size|liquidity)\b/i.test(lower)) input.sortBy = "tvl";
    else if (/\b(sort|order)\b.*\b(risk|safe|conservative)\b/i.test(lower)) input.sortBy = "risk";
    else if (/\b(sort|order)\b.*\bapy\b/i.test(lower)) input.sortBy = "apy";
    return { namespacedName: LIST_YIELD_POOLS_ACTION_NAME, input, category: "pools" };
  }

  const depPct = text.match(
    new RegExp(`\\b(?:deposit|put|supply|move)\\s+([\\d.]+%)\\s+of\\s+my\\s+(\\w+)\\s+(?:into|to|in)\\s+${YIELD_DEST}\\b`, "i"),
  );
  if (depPct) {
    const [, pct, tok] = depPct;
    return {
      namespacedName: PREPARE_YIELD_DEPOSIT_ACTION_NAME,
      input: { asset: tok, amount: pct, amountKind: "percentage" },
      category: "deposit",
    };
  }

  const depAmt = text.match(
    new RegExp(`\\b(?:deposit|put|supply|move)\\s+([\\d.,]+)\\s+(\\w+)\\s+(?:into|to|in)\\s+${YIELD_DEST}\\b`, "i"),
  );
  if (depAmt) {
    const [, amt, tok] = depAmt;
    return {
      namespacedName: PREPARE_YIELD_DEPOSIT_ACTION_NAME,
      input: { asset: tok, amount: amt, amountKind: "absolute" },
      category: "deposit",
    };
  }

  const wdAll = text.match(
    new RegExp(
      `\\b(?:withdraw|take|remove|pull)\\s+all\\s+(?:my\\s+)?(\\w+)\\s+(?:from|out\\s+of)\\s+${YIELD_DEST}\\b`,
      "i",
    ),
  );
  if (wdAll) {
    const [, tok] = wdAll;
    return {
      namespacedName: PREPARE_YIELD_WITHDRAW_ACTION_NAME,
      input: { asset: tok, amountKind: "all" },
      category: "withdraw",
    };
  }

  const wdTokenOnly = text.match(
    new RegExp(
      `\\b(?:withdraw|take|remove|pull)\\s+(?:my\\s+)?(\\w+)\\s+(?:from|out\\s+of)\\s+${YIELD_DEST}\\b`,
      "i",
    ),
  );
  if (wdTokenOnly && !/\b(?:withdraw|take|remove|pull)\s+[\d.,]+\s+\w+\s+(?:from|out\s+of)/i.test(text)) {
    const [, tok] = wdTokenOnly;
    return {
      namespacedName: PREPARE_YIELD_WITHDRAW_ACTION_NAME,
      input: { asset: tok, amountKind: "all" },
      category: "withdraw",
    };
  }

  const wdAmt = text.match(
    new RegExp(
      `\\b(?:withdraw|take|remove|pull)\\s+([\\d.,]+)\\s+(\\w+)\\s+(?:from|out\\s+of)\\s+${YIELD_DEST}\\b`,
      "i",
    ),
  );
  if (wdAmt) {
    const [, amt, tok] = wdAmt;
    return {
      namespacedName: PREPARE_YIELD_WITHDRAW_ACTION_NAME,
      input: { asset: tok, amount: amt, amountKind: "absolute" },
      category: "withdraw",
    };
  }

  return null;
}
