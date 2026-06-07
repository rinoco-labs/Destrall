import { formatWalletAddress } from "../shared/formatWalletAddress.ts";

/**
 * Shared Navi / yield / savings vocabulary for assistant intent routing.
 * "Yield" and "savings" are synonymous with Navi in user-facing language.
 */
export const NAVI_INTENT_ALIASES = {
  protocol: [
    "navi",
    "yield",
    "yields",
    "savings",
    "saving",
    "earn",
    "earning",
    "apy",
    "apys",
    "interest",
    "passive income",
    "lending",
    "supply",
    "supplied positions",
  ],
  depositDestinations: [
    "navi",
    "yield",
    "yields",
    "savings",
    "saving",
    "earn",
    "earning",
    "passive income",
    "lending",
    "supply",
  ],
  withdrawSources: [
    "navi",
    "yield",
    "yields",
    "savings",
    "saving",
    "earn",
    "earning",
    "passive income",
    "lending",
    "supply",
  ],
} as const;

/** Regex alternation for single-token Navi/yield/savings terms. */
export const NAVI_TERM_ALT =
  "navi|yields?|savings?|earn(?:ing)?|apys?|interest|lending|supply|passive\\s+income";

/** User destination for deposits: "into yield", "to savings", etc. */
export const NAVI_DEPOSIT_DESTINATION_RE = new RegExp(
  `(?:into|to|in|on)\\s+(?:my\\s+)?(?:${NAVI_TERM_ALT})\\b`,
  "i",
);

/** User source for withdrawals: "from savings", "out of yield", etc. */
export const NAVI_WITHDRAW_SOURCE_RE = new RegExp(
  `(?:from|out\\s+of)\\s+(?:my\\s+)?(?:${NAVI_TERM_ALT})\\b`,
  "i",
);

export type NaviIntentCategory = "positions" | "pools" | "deposit" | "withdraw";

const DEPOSIT_VERB_RE = /\b(?:deposit|put|supply|move|stake)\b/i;
const WITHDRAW_VERB_RE = /\b(?:withdraw|take|remove|pull)\b/i;

export function textMentionsNaviProtocol(lower: string): boolean {
  return new RegExp(`\\b(?:${NAVI_TERM_ALT})\\b`, "i").test(lower);
}

export function isNaviDepositOrWithdrawPhrase(lower: string): boolean {
  if (DEPOSIT_VERB_RE.test(lower) && NAVI_DEPOSIT_DESTINATION_RE.test(lower)) return true;
  if (WITHDRAW_VERB_RE.test(lower) && NAVI_WITHDRAW_SOURCE_RE.test(lower)) return true;
  if (/\b(?:deposit|put|supply|move)\s+.*\b(?:into|to|in)\s+(?:yield|savings?|navi)\b/.test(lower)) {
    return true;
  }
  return false;
}

export function isNaviAvailablePoolsQuestion(lower: string): boolean {
  if (/\b(?:my\s+)?(?:yield|savings?)\s+positions?\b/.test(lower)) return false;
  if (/\b(?:show|list)\s+(?:my\s+)?(?:current\s+)?(?:savings?|yield)\b/.test(lower) && !/\b(?:pool|pools|available|apy)\b/.test(lower)) {
    return false;
  }

  if (
    /\b(?:what\s+(?:yield|savings?)\s+(?:is\s+)?available|available\s+(?:yield|savings?)\s+(?:pool|pools|opportunities?)|show\s+(?:me\s+)?(?:available\s+)?(?:yield|savings?)\s+(?:pool|pools)?|where\s+can\s+i\s+earn\s+(?:yield|interest|apy)|what\s+(?:are\s+the\s+)?available\s+(?:yield|savings?)\s+(?:pool|pools)?|show\s+apys?|list\s+(?:me\s+)?(?:available\s+)?(?:yield|savings?))\b/.test(
      lower,
    )
  ) {
    return true;
  }

  if (
    /\b(what\s+yield\s+pools|yield\s+pools\s+available|available\s+yield\s+pools|available\s+yield\s+options?|what\s+are\s+the\s+available\s+yield|what\s+yield\s+(?:options?|pools|opportunities)\s+(?:are\s+)?(?:available|on\s+navi)|what\s+yield\s+is\s+available|show\s+(?:me\s+)?(?:available\s+)?yield|list\s+(?:me\s+)?(?:available\s+)?yield|yield\s+options?\s+on\s+navi|yield\s+on\s+navi|show\s+(?:me\s+)?(?:the\s+)?navi\s+pools?|navi\s+pools?|navi\s+yield|yield\s+from\s+navi|navi\s+(?:lending|lend|supply|apy)|what\s+apys?\s+(?:on\s+)?navi|what\s+pools?\s+(?:on\s+)?navi|what\s+apy\s+can\s+i\s+get|apy\s+can\s+i\s+get|how\s+much\s+apy|navi\s+protocol\s+yield)\b/.test(
      lower,
    )
  ) {
    return true;
  }

  if (
    textMentionsNaviProtocol(lower) &&
    /\b(?:pool|pools|apy|apys|available|opportunities?|where\s+can\s+i\s+earn|earn\s+yield)\b/.test(lower) &&
    !/\b(?:my\s+)?(?:positions?|postions|holding|holdings|balance\s+in|supplied|withdraw|take\s+out)\b/.test(lower)
  ) {
    return true;
  }

  return false;
}

export function classifyNaviIntentFromRoute(routedAction: string): NaviIntentCategory | null {
  if (routedAction.includes("get_yield_positions")) return "positions";
  if (routedAction.includes("list_yield_pools")) return "pools";
  if (routedAction.includes("prepare_yield_deposit")) return "deposit";
  if (routedAction.includes("prepare_yield_withdraw")) return "withdraw";
  return null;
}

export function logNaviIntentRouting(params: {
  rawText: string;
  category: NaviIntentCategory | null;
  routedAction?: string;
  walletAddress?: string;
  tokenSymbol?: string;
  poolSymbol?: string;
  errorReason?: string;
}): void {
  const wallet =
    params.walletAddress && params.walletAddress.length > 12
      ? formatWalletAddress(params.walletAddress)
      : params.walletAddress;
  console.info("[assistant][navi-intent]", {
    raw: params.rawText.slice(0, 160),
    category: params.category,
    action: params.routedAction,
    wallet,
    token: params.tokenSymbol,
    pool: params.poolSymbol,
    error: params.errorReason,
  });
}
