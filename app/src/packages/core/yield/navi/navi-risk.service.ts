import { getDatabase } from "../../../../main/persistence/database";

export type { YieldRiskProfile } from "./navi-risk.heuristics";
export {
  riskLabelForSymbol,
  isLikelyStablecoin,
  sortPoolsForRiskProfile,
  recommendationPreamble,
} from "./navi-risk.heuristics";

import type { YieldRiskProfile } from "./navi-risk.heuristics";

const YIELD_RISK_KEY = "assistant_yield_risk_tolerance";

export function readStoredYieldRiskProfile(): YieldRiskProfile {
  try {
    const row = getDatabase()
      .prepare(`SELECT value FROM app_settings WHERE key = ?`)
      .get(YIELD_RISK_KEY) as { value: string } | undefined;
    const v = row?.value?.trim();
    if (v === "conservative" || v === "balanced" || v === "aggressive" || v === "max_yield") return v;
  } catch {
    /* ignore */
  }
  return "balanced";
}
