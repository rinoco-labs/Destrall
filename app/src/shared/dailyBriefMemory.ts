/** Serializable snapshot pushed from renderer after a Daily Brief build (assistant context only). */
export type DailyBriefAssistantMemoryPayload = {
  generatedAt: number;
  accountSummary: string;
  portfolioLine: string;
  yieldLine: string;
  riskLine: string;
  opportunityLine: string;
  recommendations: string[];
};
