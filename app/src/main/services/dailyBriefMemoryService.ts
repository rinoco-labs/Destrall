import type { DailyBriefAssistantMemoryPayload } from "../../shared/dailyBriefMemory";

const memoryByAccount = new Map<string, DailyBriefAssistantMemoryPayload>();

export function setDailyBriefAssistantMemory(accountId: string, payload: DailyBriefAssistantMemoryPayload): void {
  memoryByAccount.set(accountId, payload);
}

export function dailyBriefAssistantMemoryLines(accountId: string): string[] {
  const m = memoryByAccount.get(accountId);
  if (!m) return [];
  const rec = m.recommendations.length ? m.recommendations.slice(0, 4).join(" | ") : "none noted";
  return [
    "DAILY_BRIEF_MEMORY (latest UI-generated snapshot; user may ask follow-ups without reloading):",
    `- Generated: ${new Date(m.generatedAt).toISOString()}`,
    `- Summary: ${m.accountSummary}`,
    `- Portfolio: ${m.portfolioLine}`,
    `- Yield: ${m.yieldLine}`,
    `- Risk note: ${m.riskLine}`,
    `- Opportunity: ${m.opportunityLine}`,
    `- Recent recommendations: ${rec}`,
  ].map((l) => l.slice(0, 500));
}
