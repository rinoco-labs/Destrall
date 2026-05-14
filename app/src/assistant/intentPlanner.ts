import type { SuiChainEnvironment } from "../config/chains/sui";
import type { AssistantStructuredResult } from "./assistantResultTypes";
import {
  classifySwapUserMessage,
  tryRouteAssistantToolCall,
} from "./assistantToolRouter";
import { executePackageAction } from "../packages/runtime/actionExecutor";
import { networkSettingsService } from "../main/services/network/networkSettingsService";
import { walletService } from "../main/wallet/walletService";
import { assistantDataCache } from "./cache/assistantDataCache";
import { portfolioFromBalances } from "./portfolioCardBuilder";
import { portfolioCardConcentrationNote } from "./recommendationEngine";
import { analyzePortfolio, buildPortfolioCardCaption } from "./portfolio-analysis.service";
import {
  buildYieldOpportunityCaption,
  buildYieldRecommendation,
} from "./yield-recommendation.service";
import { readStoredYieldRiskProfile, isLikelyStablecoin } from "../packages/core/yield/navi/navi-risk.service";
import { shouldUseDeterministicAssistantReply } from "./actionResolver";
import { LIST_YIELD_POOLS_ACTION_NAME } from "./assistantFunctionSchemas";
import { recordYieldOptimizationQuery, formatActivityCaption } from "./behaviorMemoryStore";

function normalizeUserText(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function isPortfolioOrBalanceQuestion(lower: string): boolean {
  if (/\bnavi\b/.test(lower) && /\b(pool|pools|yield|apy|lend|deposit)\b/.test(lower)) {
    return false;
  }
  return (
    /\b(how\s+much\b.*\b(have|own|got|worth)\b|how\s+much\s+money\b|what\s+am\s+i\s+worth)\b/.test(lower) ||
    /\b(what'?s?\s+my\s+balance|my\s+balance|total\s+(portfolio\s+)?value|net\s+worth|what\s+do\s+i\s+own|what\s+do\s+i\s+have)\b/.test(
      lower,
    ) ||
    /\b(show|list)\s+(my\s+)?(balance|balances|holdings|portfolio|tokens|assets|wallet)\b/.test(lower) ||
    /\bportfolio\b|\bholdings\b|\bmy tokens\b|\bwhat assets\b|\bportfolio worth\b|\bbalances?\b/.test(lower)
  );
}

function isYieldOptimizationQuestion(lower: string): boolean {
  return (
    /\b(maxim(?:ize|ise)|optimi(?:ze|se)|boost)\s+(?:my\s+)?(?:yield|apy|returns?)\b/.test(lower) ||
    (/\b(i\s+)?want\s+to\s+\b/.test(lower) &&
      /\b(maxim|maximise|maximize|boost)\b/.test(lower) &&
      /\b(yield|apy|returns?)\b/.test(lower)) ||
    /\b(best\s+yield|highest\s+apy|where\s+should\s+i\s+put\s+.*\b(yield|funds?)|max(?:imum)?\s+yield)\b/.test(lower)
  );
}

function isActivityQuestion(lower: string): boolean {
  return /\b(show\s+)?(my\s+)?(recent\s+)?(activity|transactions|txs?|history)\b/.test(lower);
}

function captionForBlocks(
  blocks: AssistantStructuredResult[],
  _opts: { network: string; riskProfile: ReturnType<typeof readStoredYieldRiskProfile> },
): string {
  if (blocks.length === 0) return "";
  const head = blocks[0];
  switch (head.type) {
    case "error":
      return head.message;
    case "available_yield_pools":
      return `Found ${head.pools.length} live Navi pools on ${head.network}. Details and APYs are on the card — supply always needs your explicit approval.`;
    case "yield_positions":
      return head.positions.length
        ? `You have ${head.positions.length} Navi position(s) on ${head.network} — amounts and APYs are on the card.`
        : `No Navi supply positions detected on ${head.network} for this wallet (see card).`;
    case "swappable_tokens":
      return `${head.coins.length} swappable tokens via ${head.routerLabel} — browse on the card.`;
    case "portfolio_summary": {
      const n = head.assets.length;
      return `Portfolio on ${head.network}: ${n} asset(s) with live balances on the card${head.totalUsd ? ` (~$${head.totalUsd} priced)` : ""}.`;
    }
    case "send_proposal":
    case "swap_proposal":
    case "navi_deposit_proposal":
    case "navi_withdraw_proposal":
      return "Prepared transaction — review the proposal card and approve only if details look correct.";
    case "contact_disambiguation":
      return "Pick the intended recipient on the card to continue.";
    case "transaction_result":
    case "swap_execution_result":
    case "yield_execution_result":
      return "On-chain update recorded — see the result card for digest and explorer link.";
    default: {
      const b = head as AssistantStructuredResult;
      return `See the ${b.type.replace(/_/g, " ")} card above.`;
    }
  }
}

export type AssistantStructuredPlan =
  | { mode: "deterministic"; blocks: AssistantStructuredResult[]; caption: string }
  | { mode: "llm"; blocks: AssistantStructuredResult[]; systemAddendum: string };

/**
 * Deterministic planner: builds structured cards and decides whether the local LLM is needed.
 */
export async function planAssistantStructuredTurn(
  accountId: string,
  userText: string,
): Promise<AssistantStructuredPlan> {
  const text = normalizeUserText(userText);
  const lower = text.toLowerCase();
  const env = networkSettingsService.getSuiEnvironment();

  const account = walletService.getWalletAccount(accountId);
  if (!account || account.chain !== "sui") {
    return {
      mode: "deterministic",
      blocks: [],
      caption: "Switch to a Sui account to use portfolio and yield tools.",
    };
  }

  const riskProfile = readStoredYieldRiskProfile();
  const networkLabel = env.charAt(0).toUpperCase() + env.slice(1);

  const swapGap = classifySwapUserMessage(text);
  if (swapGap === "missing_to") {
    return {
      mode: "deterministic",
      blocks: [{ type: "error", message: "What token do you want to receive?", code: "swap_incomplete" }],
      caption: "What token do you want to receive?",
    };
  }
  if (swapGap === "missing_amount" || swapGap === "incomplete") {
    return {
      mode: "deterministic",
      blocks: [
        {
          type: "error",
          message: "I need an amount, from token, and to token to prepare a swap.",
          code: "swap_incomplete",
        },
      ],
      caption: "I need an amount, from token, and to token to prepare a swap.",
    };
  }

  if (isActivityQuestion(lower)) {
    const items = await assistantDataCache.getActivityPreview(accountId);
    return {
      mode: "deterministic",
      blocks: [],
      caption: formatActivityCaption(items, networkLabel),
    };
  }

  if (isPortfolioOrBalanceQuestion(lower)) {
    const tBal = performance.now();
    const balances = await assistantDataCache.getTokenBalances(accountId);
    console.info(`[assistant] fetch balances ${(performance.now() - tBal).toFixed(0)}ms`);
    const tPos = performance.now();
    const naviViews = await assistantDataCache.getNaviPositionViews(accountId, env);
    console.info(`[assistant] fetch positions ${(performance.now() - tPos).toFixed(0)}ms`);
    const naviPositions = naviViews.map((v) => ({
      symbol: v.assetSymbol,
      suppliedFormatted: v.suppliedFormatted,
      apy: v.apy,
    }));
    const pools = env === "mainnet" ? await assistantDataCache.getNaviPools(env) : [];
    const stablePoolApyHints = pools
      .filter((p) => isLikelyStablecoin(p.symbol))
      .sort((a, b) => b.supplyApy - a.supplyApy)
      .slice(0, 5)
      .map((p) => ({ symbol: p.symbol, apyPct: p.supplyApy }));

    const analysis = analyzePortfolio({
      balances,
      riskProfile,
      suiEnvironment: env,
      naviPositions,
      stablePoolApyHints,
    });
    const pricedCount = balances.filter((b) => b.usdValue && b.usdValue !== "").length;
    const block = portfolioFromBalances(env, balances);
    const concentrationNote = portfolioCardConcentrationNote(balances);
    if (block.type === "portfolio_summary" && concentrationNote) {
      block.concentrationNote = concentrationNote;
    }
    const caption = buildPortfolioCardCaption(analysis, pricedCount, balances.length);
    return { mode: "deterministic", blocks: [block], caption };
  }

  if (isYieldOptimizationQuestion(lower)) {
    recordYieldOptimizationQuery(accountId);
    let yieldCaptionExtra = "";
    if (env === "mainnet") {
      const pools = await assistantDataCache.getNaviPools(env);
      const rec = buildYieldRecommendation(pools, riskProfile);
      yieldCaptionExtra = buildYieldOpportunityCaption(rec, riskProfile, networkLabel);
    }
    const tExec = performance.now();
    const blocks = await executePackageAction({
      accountId,
      namespacedName: LIST_YIELD_POOLS_ACTION_NAME,
      input: { sortBy: "apy", riskProfile },
    });
    console.info(`[assistant] fetch pools / package action ${(performance.now() - tExec).toFixed(0)}ms`);
    const caption = yieldCaptionExtra
      ? `${yieldCaptionExtra} See the pool card for the full live list.`
      : captionForBlocks(blocks, { network: networkLabel, riskProfile });
    return { mode: "deterministic", blocks, caption };
  }

  const routed = tryRouteAssistantToolCall(text);
  if (routed) {
    try {
      const tExec = performance.now();
      const blocks = await executePackageAction({
        accountId,
        namespacedName: routed.namespacedName,
        input: routed.input,
      });
      console.info(`[assistant] package action ${routed.namespacedName} ${(performance.now() - tExec).toFixed(0)}ms`);
      let systemAddendum = "";
      if (blocks.length > 0) {
        const t = blocks[0]?.type;
        if (t === "send_proposal" || t === "contact_disambiguation") {
          systemAddendum =
            "\n\n[A structured send or contact-choice card is shown. Add at most one short sentence; do not repeat addresses or amounts.]";
        } else if (t === "swap_proposal") {
          systemAddendum =
            "\n\n[A swap review card is shown. Add at most one short sentence: confirm trade direction and that execution requires explicit user approval; offer to refine amounts or slippage if asked — do not repeat quoted amounts or routes.]";
        } else if (t === "swappable_tokens") {
          systemAddendum =
            "\n\n[A Sui-only swappable-token list card is shown (app registry). Summarize briefly; do not read every line aloud.]";
        } else if (t === "available_yield_pools") {
          systemAddendum =
            "\n\n[A Navi yield pools card is shown with live APY when available. Summarize briefly; do not invent rates.]";
        } else if (t === "yield_positions") {
          systemAddendum =
            "\n\n[A Navi yield positions card is shown. Summarize briefly; do not claim positions the card does not list.]";
        } else if (t === "navi_deposit_proposal" || t === "navi_withdraw_proposal") {
          systemAddendum =
            "\n\n[A Navi transaction review card is shown. Add at most one short sentence: note protocol/yield risks and that funds move only after the user approves the card.]";
        }
      }

      if (shouldUseDeterministicAssistantReply(blocks)) {
        let caption = captionForBlocks(blocks, { network: networkLabel, riskProfile });
        if (routed.namespacedName === LIST_YIELD_POOLS_ACTION_NAME && env === "mainnet") {
          const pools = await assistantDataCache.getNaviPools(env);
          const rec = buildYieldRecommendation(pools, riskProfile);
          caption = `${buildYieldOpportunityCaption(rec, riskProfile, networkLabel)} See the pool card for all rows.`;
        }
        return { mode: "deterministic", blocks, caption };
      }

      return { mode: "llm", blocks, systemAddendum };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Action failed.";
      return {
        mode: "deterministic",
        blocks: [{ type: "error", message: msg, code: "action_failed" }],
        caption: msg,
      };
    }
  }

  return { mode: "llm", blocks: [], systemAddendum: "" };
}
