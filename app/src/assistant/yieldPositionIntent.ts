/**
 * Natural-language detection for "what do I have in Navi / savings / yield?" queries.
 * Shared by intentPlanner (early) and assistantToolRouter.
 */
export function isYieldPositionsQuestion(lower: string): boolean {
  if (/\b(?:deposit|withdraw|supply|lend)\s+.*\b(?:into|to|from|out\s+of)\s+navi\b/.test(lower)) {
    return false;
  }
  if (/\b(?:list|show|what)\s+.*\b(?:available|best)\s+.*\b(?:yield\s+)?pools?\b/.test(lower)) {
    return false;
  }
  if (/\bbest\s+apy\b|\bhighest\s+apy\b|\bwhere\s+(?:should\s+i|can\s+i)\s+(?:put|deposit)\b/.test(lower)) {
    return false;
  }

  if (/\b(?:my\s+)?yield\s+positions?\b/.test(lower)) return true;
  if (/\bnavi\s+positions?\b/.test(lower)) return true;
  if (/\b(?:savings?|yield)\s+(?:balance|balances|holdings?|positions?)\b/.test(lower)) return true;
  if (/\b(?:how\s+much|what).*\b(?:in|on)\s+(?:my\s+)?(?:savings?|navi|yield)\b/.test(lower)) return true;
  if (/\bhow\s+much\s+(?:do\s+i\s+have|have\s+i|am\s+i)\s+(?:in|on)\s+(?:savings?|navi|yield)\b/.test(lower)) return true;
  if (/\bwhat\s+(?:do\s+i\s+have|have\s+i\s+got|am\s+i)\s+(?:in|on)\s+(?:savings?|navi|yield)\b/.test(lower)) return true;
  if (/\bwhat\s+am\s+i\s+(?:earning|supplied|lending)\b/.test(lower)) return true;
  if (/\b(?:show|list)\s+(?:my\s+)?(?:navi|yield)\s+(?:positions?|holdings?|savings?)\b/.test(lower)) return true;
  if (
    /\bnavi\b/.test(lower) &&
    /\b(?:positions?|holdings?|supplied|supply\s+balance|what\s+i\s+have|how\s+much)\b/.test(lower) &&
    !/\b(?:pool|pools|apy\s+on|available)\b/.test(lower)
  ) {
    return true;
  }

  return false;
}
