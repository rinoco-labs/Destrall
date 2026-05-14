import type { SuiChainEnvironment } from "../../config/chains/sui";
import type { DailyBriefAssistantMemoryPayload } from "../../shared/dailyBriefMemory";
import {
  desktopGetChainActivity,
  desktopGetChainBalances,
  desktopGetDailyBriefChainBundle,
  desktopPublishDailyBriefMemory,
} from "../../renderer/lib/desktopChain";
import { buildDailyBrief, buildNonSuiDailyBriefPlaceholder } from "./daily-brief-builder";
import { dailyBriefCache } from "./daily-brief-cache";
import type { DailyBrief } from "./daily-brief-types";

async function publishAssistantMemory(accountId: string, brief: DailyBrief): Promise<void> {
  const memory: DailyBriefAssistantMemoryPayload = {
    generatedAt: brief.generatedAt,
    accountSummary: brief.homeSummaryLines.join(" "),
    portfolioLine:
      brief.homeSummaryLines.find((l) => /largest|largest priced|worth about/i.test(l)) ??
      `Priced total about ${brief.portfolioSummary.totalValueLabel}.`,
    yieldLine:
      brief.yieldSummary.activePositions.length > 0
        ? `${brief.yieldSummary.activePositions.length} Navi supply position(s); headline pool APY in snapshot: ${brief.yieldSummary.highestApySymbol ?? "n/a"} ~${brief.yieldSummary.highestApyPct != null ? brief.yieldSummary.highestApyPct.toFixed(2) : "—"}%.`
        : "No Navi supply positions in configured pools for this address.",
    riskLine: brief.riskAlerts[0] ?? "No extra concentration or volatility flags from heuristics.",
    opportunityLine: brief.opportunities[0] ?? "No specific idle-asset prompt.",
    recommendations: brief.recommendations.slice(0, 8),
  };
  try {
    await desktopPublishDailyBriefMemory({ accountId, memory });
  } catch {
    /* best-effort */
  }
}

export async function loadDailyBrief(params: {
  accountId: string;
  accountName: string;
  isSuiAccount: boolean;
  suiEnvironment: SuiChainEnvironment;
  networkLabel: string;
}): Promise<DailyBrief> {
  const key = `${params.accountId}:${params.suiEnvironment}`;
  return dailyBriefCache.getOrRevalidate(key, async () => {
    const chainBundle = await desktopGetDailyBriefChainBundle(params.accountId);

    if (!params.isSuiAccount) {
      const brief = buildNonSuiDailyBriefPlaceholder({
        accountId: params.accountId,
        accountName: params.accountName,
        suiEnvironment: params.suiEnvironment,
        networkLabel: params.networkLabel,
        riskProfile: chainBundle.riskProfile,
      });
      void publishAssistantMemory(params.accountId, brief);
      return brief;
    }

    const [balances, activityPage] = await Promise.all([
      desktopGetChainBalances(params.accountId),
      desktopGetChainActivity({ accountId: params.accountId }),
    ]);

    const brief = buildDailyBrief({
      accountId: params.accountId,
      accountName: params.accountName,
      isSuiAccount: true,
      suiEnvironment: params.suiEnvironment,
      networkLabel: params.networkLabel,
      balances,
      activityItems: activityPage.items,
      chainBundle,
    });
    void publishAssistantMemory(params.accountId, brief);
    return brief;
  });
}
