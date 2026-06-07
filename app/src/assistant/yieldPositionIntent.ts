/**
 * Natural-language detection for "what do I have in Navi / savings / yield?" queries.
 * Shared by intentPlanner (early) and assistantToolRouter.
 */
import {
  isNaviDepositOrWithdrawPhrase,
  NAVI_TERM_ALT,
  textMentionsNaviProtocol,
} from "./naviIntentVocabulary.ts";

export function isYieldPositionsQuestion(lower: string): boolean {
  if (isNaviDepositOrWithdrawPhrase(lower)) {
    return false;
  }
  if (/\b(?:list|show|what)\s+.*\b(?:available|best)\s+.*\b(?:yield\s+)?(?:savings\s+)?pools?\b/.test(lower)) {
    return false;
  }
  if (/\b(?:available|best)\s+(?:yield|savings?)\s+(?:pool|pools|opportunities?)\b/.test(lower)) {
    return false;
  }
  if (/\bwhere\s+can\s+i\s+earn\b/.test(lower)) {
    return false;
  }
  if (/\bbest\s+apy\b|\bhighest\s+apy\b|\bwhere\s+(?:should\s+i|can\s+i)\s+(?:put|deposit)\b/.test(lower)) {
    return false;
  }

  if (/\b(?:my\s+)?yield\s+positions?\b/.test(lower)) return true;
  if (/\bnavi\s+positions?\b/.test(lower)) return true;
  if (/\b(?:savings?|yield)\s+(?:balance|balances|holdings?|positions?)\b/.test(lower)) return true;
  // "what are my savings", "what is my yield", "show me my savings"
  if (
    /\bwhat\s+(?:are|is)\s+(?:my\s+)?(?:savings?|yield)\b/.test(lower) &&
    !/\b(?:available|pool|pools|rate|rates|apy|option|opportunity)\b/.test(lower)
  ) {
    return true;
  }
  if (
    /\b(?:show|see|view)(?:\s+me)?\s+(?:my\s+)?(?:current\s+)?(?:savings?|yield)\b/.test(lower) &&
    !/\b(?:pool|pools|available|apy|option)\b/.test(lower)
  ) {
    return true;
  }
  if (/\b(?:how\s+much|what).*\b(?:in|on)\s+(?:my\s+)?(?:savings?|navi|yield)\b/.test(lower)) return true;
  if (/\bhow\s+much\s+(?:do\s+i\s+have|have\s+i|am\s+i)\s+(?:in|on)\s+(?:savings?|navi|yield)\b/.test(lower)) return true;
  if (/\bwhat\s+(?:do\s+i\s+have|have\s+i\s+got|am\s+i)\s+(?:in|on)\s+(?:savings?|navi|yield)\b/.test(lower)) return true;
  if (/\bwhat\s+yield\s+do\s+i\s+have\s+open\b/.test(lower)) return true;
  if (/\bwhat\s+am\s+i\s+(?:earning|supplied|lending)\b/.test(lower)) return true;
  if (/\b(?:show|list)\s+(?:my\s+)?(?:navi|yield|savings?)\s+(?:positions?|holdings?|savings?)\b/.test(lower)) {
    return true;
  }
  if (/\b(?:show|list)\s+(?:my\s+)?(?:current\s+)?savings\b/.test(lower) && !/\b(?:pool|pools|available)\b/.test(lower)) {
    return true;
  }
  if (/\b(?:my\s+)?(?:open\s+)?(?:yield|savings?)\b.*\b(?:open|positions?)\b/.test(lower)) {
    return true;
  }
  if (
    textMentionsNaviProtocol(lower) &&
    /\b(?:positions?|holdings?|supplied|supply\s+balance|what\s+i\s+have|how\s+much)\b/.test(lower) &&
    !/\b(?:pool|pools|apy\s+on|available)\b/.test(lower)
  ) {
    return true;
  }

  return false;
}

export { NAVI_TERM_ALT, textMentionsNaviProtocol };
