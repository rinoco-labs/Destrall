import { walletService } from "../main/wallet/walletService";
import { actionRegistry } from "../packages/runtime/actionRegistry";
import { contactRepository } from "../main/persistence/repositories/contactRepository";
import { assistantToolDefinitionsForModel } from "./assistantFunctionSchemas";
import { networkSettingsService } from "../main/services/network/networkSettingsService";
import { readStoredYieldRiskProfile } from "../packages/core/yield/navi/navi-risk.service";
import { isLikelyStablecoin } from "../packages/core/yield/navi/navi-risk.heuristics";
import { assistantDataCache } from "./cache/assistantDataCache";
import { analyzePortfolio } from "./portfolio-analysis.service";
import { buildPortfolioRecommendationDigest } from "./recommendationEngine";
import { behaviorMemoryLines } from "./behaviorMemoryStore";
import { dailyBriefAssistantMemoryLines } from "../main/services/dailyBriefMemoryService";
import { buildAssistantTimeContextBlock } from "../services/time/time.service";
import { triggerStorageService } from "../packages/core/triggers/triggerStorageService";
import { buildAssistantCapabilitiesContextBlock } from "./knowledge/assistant-capabilities.service";

function contactInScope(accountId: string, row: { accountId: string | null; chain: string }): boolean {
  if (row.chain !== "sui") return false;
  if (row.accountId != null && row.accountId !== accountId) return false;
  return true;
}

export type CompactContextOptions = {
  pendingProposalsSummary?: string;
};

/**
 * Compact, token-efficient context for LLM turns (cached reads, no huge dumps).
 */
export async function buildCompactAssistantContext(
  accountId: string,
  options?: CompactContextOptions,
): Promise<string> {
  const account = walletService.getWalletAccount(accountId);
  const env = networkSettingsService.getSuiEnvironment();
  const net = networkSettingsService.getSnapshot();
  const riskProfile = readStoredYieldRiskProfile();
  const lines: string[] = [];

  if (!account) {
    return `No wallet account for id ${accountId}.`;
  }

  lines.push(`ACTIVE: ${account.name} | ${account.id} | ${account.address}`);
  lines.push(`NETWORK: ${net.activeEnvironment} (${net.chainIdLabel})`);
  lines.push(buildAssistantTimeContextBlock());

  if (account.chain === "sui") {
    const balances = await assistantDataCache.getTokenBalances(accountId);
    const naviViews = await assistantDataCache.getNaviPositionViews(accountId, env);
    const naviPositions = naviViews.map((v) => ({
      symbol: v.assetSymbol,
      suppliedFormatted: v.suppliedFormatted,
      apy: v.apy,
    }));
    const pools = env === "mainnet" ? await assistantDataCache.getNaviPools(env) : [];
    const stablePoolApyHints = pools
      .filter((p) => isLikelyStablecoin(p.symbol))
      .sort((a, b) => b.supplyApy - a.supplyApy)
      .slice(0, 4)
      .map((p) => ({ symbol: p.symbol, apyPct: p.supplyApy }));

    lines.push(
      `PORTFOLIO (cached, top 12): ${balances
        .slice(0, 12)
        .map((b) => `${b.symbol}:${b.balanceFormatted}${b.usdValue ? `~${b.usdValue}` : ""}`)
        .join(" | ") || "empty"}`,
    );

    const digest = buildPortfolioRecommendationDigest({
      balances,
      riskProfile,
      suiEnvironment: env,
      naviPositions,
      stablePoolApyHints,
    });
    const analysis = analyzePortfolio({
      balances,
      riskProfile,
      suiEnvironment: env,
      naviPositions,
      stablePoolApyHints,
    });
    lines.push(
      `HEURISTICS: riskScore=${analysis.riskScore}/100 diversification=${analysis.diversificationScore}/100 stablePct=${analysis.stableExposurePct ?? "n/a"}`,
    );
    if (digest.proactiveTriggers[0]) {
      lines.push(`TRIGGER: ${digest.proactiveTriggers[0]}`.slice(0, 220));
    }

    for (const m of behaviorMemoryLines(accountId)) {
      lines.push(m);
    }
    for (const m of dailyBriefAssistantMemoryLines(accountId)) {
      lines.push(m);
    }
  }

  const contacts = contactRepository
    .list()
    .filter((c) => contactInScope(accountId, c))
    .slice(0, 8)
    .map((c) => `${c.name}:${c.address.slice(0, 10)}…`);
  lines.push(`CONTACTS: ${contacts.length ? contacts.join(", ") : "none"}`);

  lines.push("TOOLS: " + assistantToolDefinitionsForModel.map((t) => t.name.split(".").pop()).join(", "));
  const descriptors = actionRegistry.listForAssistant();
  lines.push(
    "ACTIONS: " +
      descriptors
        .slice(0, 12)
        .map((d) => d.namespacedName.replace(/^core\./, ""))
        .join(", "),
  );

  lines.push(`RISK_PROFILE: ${riskProfile}`);

  const activeTriggers = triggerStorageService.list(accountId).filter((t) => t.status === "active");
  if (activeTriggers.length) {
    lines.push(
      `ACTIVE_TRIGGERS (${activeTriggers.length}): ${activeTriggers
        .slice(0, 6)
        .map((t) => `${t.name}[${t.type}/${t.status}]`)
        .join(" | ")}`,
    );
  } else {
    lines.push("ACTIVE_TRIGGERS: none");
  }
  lines.push(
    "TRIGGER_ACTIONS: create_trigger (requires approval card), list_triggers, pause_trigger, resume_trigger, delete_trigger",
  );
  lines.push(
    "RULE_TRIGGERS: Never create triggers without user approving the review card. Never execute outside pre-approved limits.",
  );

  lines.push("RULE: Never ask for the wallet address — it is above. Never invent balances or APYs.");
  lines.push(buildAssistantCapabilitiesContextBlock());

  if (options?.pendingProposalsSummary?.trim()) {
    lines.push(`PENDING_PROPOSALS:\n${options.pendingProposalsSummary.trim()}`.slice(0, 800));
  }

  return lines.join("\n");
}
