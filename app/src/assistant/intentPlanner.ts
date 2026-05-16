import type { AssistantStructuredResult } from "./assistantResultTypes";
import { classifySwapUserMessage, tryRouteAssistantToolCall } from "./assistantToolRouter";
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
import { readStoredYieldRiskProfile } from "../packages/core/yield/navi/navi-risk.service";
import { isLikelyStablecoin } from "../packages/core/yield/navi/navi-risk.heuristics";
import { shouldUseDeterministicAssistantReply } from "./actionResolver";
import {
  GET_WALLET_ADDRESS_ACTION_NAME,
  GET_YIELD_POSITIONS_ACTION_NAME,
  LIST_YIELD_POOLS_ACTION_NAME,
  PREPARE_REBALANCE_ACTION_NAME,
  PREPARE_YIELD_DEPOSIT_ACTION_NAME,
  SWAP_THEN_DEPOSIT_ACTION_NAME,
} from "./assistantFunctionSchemas";
import { isYieldPositionsQuestion } from "./yieldPositionIntent";
import { recordYieldOptimizationQuery, formatActivityCaption } from "./behaviorMemoryStore";
import {
  getConversationContext,
  setConversationContext,
  clearConversationField,
} from "./conversationContextStore";
import { parseRebalanceTargets } from "../packages/core/rebalance/rebalancePlanner";
import {
  CREATE_TRIGGER_ACTION_NAME,
  GET_CURRENT_TIME_ACTION_NAME,
  LIST_TRIGGERS_ACTION_NAME,
} from "./assistantFunctionSchemas";
import { triggerStorageService } from "../packages/core/triggers/triggerStorageService";
import { timezoneSettingsService } from "../services/time/timezone.service";
import { hasScheduleIntent } from "../packages/core/triggers/scheduledTriggerParser";
import {
  buildAssistantCapabilitiesStructuredResult,
  buildCapabilityHelpCaption,
  matchCapabilityHelpIntent,
} from "./knowledge/assistant-capabilities.service";

function normalizeUserText(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function isWalletAddressQuestion(lower: string): boolean {
  return (
    /\b(what\s+is\s+my\s+(?:sui\s+)?wallet\s+address|my\s+wallet\s+address|show\s+my\s+address|copy\s+my\s+address|what\s+address\s+am\s+i\s+using|what\s+is\s+this\s+account\s+address|my\s+public\s+address|my\s+sui\s+address)\b/.test(
      lower,
    ) || /\b(show|copy)\s+my\s+(wallet\s+)?address\b/.test(lower)
  );
}

function isPortfolioOrBalanceQuestion(lower: string): boolean {
  if (isWalletAddressQuestion(lower)) return false;
  if (isYieldPositionsQuestion(lower)) return false;
  if (/\bnavi\b/.test(lower) && /\b(pool|pools|yield|apy|lend|deposit)\b/.test(lower)) {
    return false;
  }
  return (
    /\b(how\s+much\b.*\b(have|own|got|worth)\b|how\s+much\s+money\b|what\s+am\s+i\s+worth)\b/.test(lower) ||
    /\b(what'?s?\s+my\s+balance|my\s+balance|total\s+(portfolio\s+)?value|net\s+worth|what\s+do\s+i\s+own|what\s+do\s+i\s+have)\b/.test(
      lower,
    ) ||
    /\b(show|list)\s+(my\s+)?(balance|balances|holdings|portfolio|tokens|assets|wallet)\b/.test(lower) ||
    /\bwhat\s+is\s+in\s+my\s+wallet\b|\bwhat\s+tokens\s+do\s+i\s+have\b|\bwallet\s+balance\b/.test(lower) ||
    /\bportfolio\b|\bholdings\b|\bmy tokens\b|\bwhat assets\b|\bportfolio worth\b|\bbalances?\b/.test(lower)
  );
}

function isPureBestApyQuestion(lower: string): boolean {
  return /\b(what\s+is\s+the\s+best\s+apy|best\s+apy|highest\s+apy|what\s+pool\s+has\s+the\s+best\s+apy|where\s+can\s+i\s+get\s+the\s+most\s+yield|what\s+is\s+the\s+pool\s+with\s+the\s+best\s+apy)\b/.test(
    lower,
  );
}

function isYieldOptimizationQuestion(lower: string): boolean {
  if (isPureBestApyQuestion(lower)) return false;
  return (
    /\b(maxim(?:ize|ise)|optimi(?:ze|se)|boost)\s+(?:my\s+)?(?:yield|apy|returns?)\b/.test(lower) ||
    (/\b(i\s+)?want\s+to\s+\b/.test(lower) &&
      /\b(maxim|maximise|maximize|boost)\b/.test(lower) &&
      /\b(yield|apy|returns?)\b/.test(lower)) ||
    /\b(best\s+yield|where\s+should\s+i\s+put\s+.*\b(yield|funds?)|max(?:imum)?\s+yield)\b/.test(lower)
  );
}

function isActivityQuestion(lower: string): boolean {
  return /\b(show\s+)?(my\s+)?(recent\s+)?(activity|transactions|txs?|history)\b/.test(lower);
}

function isTimeQuestion(lower: string): boolean {
  return (
    /\b(what\s+time\s+is\s+it|what'?s?\s+the\s+current\s+time|what\s+time\s+is\s+it\s+now|tell\s+me\s+the\s+time)\b/.test(
      lower,
    ) || /\b(what\s+timezone\s+am\s+i\s+in|what\s+time\s+zone|my\s+timezone)\b/.test(lower)
  );
}

function isTriggersTodayQuestion(lower: string): boolean {
  return /\b(?:what\s+)?triggers?\s+(?:are\s+)?(?:scheduled|due)\s+today\b/.test(lower);
}

function isLooseRebalanceAsk(lower: string): boolean {
  if (/\d+\s*%/.test(lower)) return false;
  return /\b(rebalance\s+my\s+portfolio|rebalance|adjust\s+my\s+allocation)\b/.test(lower);
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
    case "wallet_address":
      return `Active address on ${head.network} (${head.accountLabel}) — use copy on the card.`;
    case "rebalance_proposal":
      return head.executable
        ? `Rebalance on ${head.network}: ${head.swaps.length} swap leg(s) in one PTB — approve on the card when ready.`
        : `Rebalance plan on ${head.network}: ${head.swaps.length} suggested swap leg(s) on the card.`;
    case "composite_swap_then_deposit":
      return head.executionModel === "ptb"
        ? "Single-transaction swap and Navi deposit — review steps on the card and approve once."
        : "Staged swap then deposit: approve the swap first; deposit is estimated until the swap confirms.";
    case "send_proposal":
    case "swap_proposal":
    case "navi_deposit_proposal":
    case "navi_withdraw_proposal":
      return "Prepared transaction — review the proposal card and approve only if details look correct.";
    case "trigger_proposal": {
      const when = head.nextExecutionLabel ?? head.scheduleDisplay ?? head.scheduleLabel;
      if (when) {
        return `Scheduled automation is on the card (${when}). Tap Approve Trigger to save — nothing runs until you pre-approve.`;
      }
      return "Automation trigger ready — review the card and tap Approve Trigger to save. Nothing runs until you pre-approve.";
    }
    case "trigger_list":
      return `You have ${head.triggers.length} trigger(s) on the card — pause, resume, or delete from there.`;
    case "time_info":
      return `It's ${head.formatted} (${head.weekday}).`;
    case "assistant_capabilities":
      return "Here are the main things I can help you do.";
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

export type PlanAssistantStructuredOptions = {
  chatId?: string;
  pendingProposalsSummary?: string;
};

/**
 * Deterministic planner: builds structured cards and decides whether the local LLM is needed.
 */
export async function planAssistantStructuredTurn(
  accountId: string,
  userText: string,
  options?: PlanAssistantStructuredOptions,
): Promise<AssistantStructuredPlan> {
  const text = normalizeUserText(userText);
  const lower = text.toLowerCase();
  const env = networkSettingsService.getSuiEnvironment();
  const chatId = (options?.chatId && options.chatId.trim()) || "_default";
  const convo = getConversationContext(accountId, chatId);

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
  if (!hasScheduleIntent(text) && swapGap === "missing_to") {
    return {
      mode: "deterministic",
      blocks: [{ type: "error", message: "What token do you want to receive?", code: "swap_incomplete" }],
      caption: "What token do you want to receive?",
    };
  }
  if (!hasScheduleIntent(text) && (swapGap === "missing_amount" || swapGap === "incomplete")) {
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

  if (options?.pendingProposalsSummary?.trim() && lower.length < 96) {
    if (/\b(yes|yep|approve|approved|confirm|ok|go\s+ahead|reject|no|cancel|dismiss|discard)\b/i.test(lower)) {
      return {
        mode: "deterministic",
        blocks: [],
        caption:
          "Use Approve or Dismiss on the proposal card in this chat — I cannot submit transactions from text alone.",
      };
    }
  }

  if (convo.pendingClarification === "schedule_ampm" && convo.pendingSchedule) {
    const pending = convo.pendingSchedule;
    const am = /\b(am|a\.m\.|morning)\b/i.test(lower);
    const pm = /\b(pm|p\.m\.|evening|night)\b/i.test(lower);
    if (am || pm) {
      const suffix = am ? " am" : " pm";
      const merged = `${pending.originalText} ${pending.dateLabel} at ${pending.partialHour}${suffix}`;
      clearConversationField(accountId, chatId, "pendingClarification");
      clearConversationField(accountId, chatId, "pendingSchedule");
      try {
        const blocks = await executePackageAction({
          accountId,
          namespacedName: CREATE_TRIGGER_ACTION_NAME,
          input: { naturalLanguage: merged },
        });
        const cap = captionForBlocks(blocks, { network: networkLabel, riskProfile });
        if (blocks[0]?.type === "trigger_proposal") {
          return {
            mode: "deterministic",
            blocks,
            caption: cap.includes("card")
              ? cap
              : `Scheduled trigger ready — review the card and approve. It will run at the time you specified in your timezone.`,
          };
        }
        return { mode: "deterministic", blocks, caption: cap };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not build scheduled trigger.";
        return { mode: "deterministic", blocks: [{ type: "error", message: msg }], caption: msg };
      }
    }
    return {
      mode: "deterministic",
      blocks: [],
      caption: `Do you mean ${pending.partialHour} AM or ${pending.partialHour} PM ${pending.dateLabel}?`,
    };
  }

  if (isTimeQuestion(lower)) {
    try {
      const blocks = await executePackageAction({
        accountId,
        namespacedName: GET_CURRENT_TIME_ACTION_NAME,
        input: {},
      });
      return { mode: "deterministic", blocks, caption: captionForBlocks(blocks, { network: networkLabel, riskProfile }) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not read time.";
      return { mode: "deterministic", blocks: [{ type: "error", message: msg }], caption: msg };
    }
  }

  if (isTriggersTodayQuestion(lower)) {
    const rows = triggerStorageService.list(accountId).filter((t) => t.status === "active" && t.nextCheckAt);
    const todayParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezoneSettingsService.getTimezone(),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const tz = timezoneSettingsService.getTimezone();
    const todayRows = rows.filter((r) => {
      if (!r.nextCheckAt) return false;
      let rowTz = tz;
      if (r.scheduleJson) {
        try {
          const s = JSON.parse(r.scheduleJson) as { timezone?: string };
          if (s.timezone) rowTz = s.timezone;
        } catch {
          /* keep default */
        }
      }
      const d = new Intl.DateTimeFormat("en-CA", {
        timeZone: rowTz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(r.nextCheckAt));
      return d === todayParts;
    });
    try {
      const blocks = await executePackageAction({
        accountId,
        namespacedName: LIST_TRIGGERS_ACTION_NAME,
        input: {},
      });
      const caption =
        todayRows.length > 0
          ? `You have ${todayRows.length} active trigger(s) with a next check today (see list on the card).`
          : "No active triggers are scheduled to check today for this account.";
      return { mode: "deterministic", blocks, caption };
    } catch {
      return {
        mode: "deterministic",
        blocks: [],
        caption: "Could not load triggers.",
      };
    }
  }

  if (convo.pendingClarification === "rebalance_distribution") {
    const parsedTargets = parseRebalanceTargets(text);
    if (parsedTargets) {
      clearConversationField(accountId, chatId, "pendingClarification");
      try {
        const blocks = await executePackageAction({
          accountId,
          namespacedName: PREPARE_REBALANCE_ACTION_NAME,
          input: { distributionText: text },
        });
        setConversationContext(accountId, chatId, { recentUserIntent: "rebalance" });
        if (shouldUseDeterministicAssistantReply(blocks)) {
          return { mode: "deterministic", blocks, caption: captionForBlocks(blocks, { network: networkLabel, riskProfile }) };
        }
        return { mode: "llm", blocks, systemAddendum: "\n\n[A rebalance plan card is shown. Summarize briefly.]" };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Rebalance plan failed.";
        return { mode: "deterministic", blocks: [{ type: "error", message: msg, code: "action_failed" }], caption: msg };
      }
    }
  }

  if (isWalletAddressQuestion(lower)) {
    try {
      const blocks = await executePackageAction({
        accountId,
        namespacedName: GET_WALLET_ADDRESS_ACTION_NAME,
        input: {},
      });
      setConversationContext(accountId, chatId, { recentUserIntent: "wallet_address" });
      return { mode: "deterministic", blocks, caption: captionForBlocks(blocks, { network: networkLabel, riskProfile }) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not read address.";
      return { mode: "deterministic", blocks: [{ type: "error", message: msg, code: "action_failed" }], caption: msg };
    }
  }

  if (isYieldPositionsQuestion(lower)) {
    try {
      const blocks = await executePackageAction({
        accountId,
        namespacedName: GET_YIELD_POSITIONS_ACTION_NAME,
        input: {},
      });
      setConversationContext(accountId, chatId, { recentUserIntent: "yield_positions" });
      if (shouldUseDeterministicAssistantReply(blocks)) {
        return { mode: "deterministic", blocks, caption: captionForBlocks(blocks, { network: networkLabel, riskProfile }) };
      }
      return {
        mode: "llm",
        blocks,
        systemAddendum: "\n\n[A Navi yield positions card is shown. Summarize supplied amounts briefly; do not invent positions.]",
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load yield positions.";
      return { mode: "deterministic", blocks: [{ type: "error", message: msg, code: "action_failed" }], caption: msg };
    }
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
    setConversationContext(accountId, chatId, { recentUserIntent: "portfolio" });
    return { mode: "deterministic", blocks: [block], caption };
  }

  const depThat = text.match(
    /\b(?:deposit|put|supply)\s+([\d.,]+%?)\s+of\s+my\s+(\w+)\s+(?:into|to|in)\s+(?:that\s+pool|the\s+pool|it)\b/i,
  );
  if (depThat && convo.lastMentionedPool) {
    const [, amt, spendTok] = depThat;
    const pool = convo.lastMentionedPool;
    const amountKind = /%/.test(amt) ? "percentage" : "absolute";
    const amount = amt.replace(/\s+/g, "");
    const spend = spendTok.toUpperCase();
    const poolSym = pool.symbol.toUpperCase();
    try {
      const blocks =
        spend === poolSym
          ? await executePackageAction({
              accountId,
              namespacedName: PREPARE_YIELD_DEPOSIT_ACTION_NAME,
              input: { asset: pool.symbol, amount, amountKind },
            })
          : await executePackageAction({
              accountId,
              namespacedName: SWAP_THEN_DEPOSIT_ACTION_NAME,
              input: {
                spendSymbol: spend,
                poolAssetSymbol: pool.symbol,
                amount,
                amountKind,
              },
            });
      setConversationContext(accountId, chatId, { recentUserIntent: "yield_deposit_followup" });
      if (shouldUseDeterministicAssistantReply(blocks)) {
        return { mode: "deterministic", blocks, caption: captionForBlocks(blocks, { network: networkLabel, riskProfile }) };
      }
      return { mode: "llm", blocks, systemAddendum: "\n\n[A yield proposal card is shown. One short sentence.]" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not prepare deposit.";
      return { mode: "deterministic", blocks: [{ type: "error", message: msg, code: "action_failed" }], caption: msg };
    }
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
        } else if (t === "composite_swap_then_deposit") {
          systemAddendum =
            blocks[0].executionModel === "ptb"
              ? "\n\n[A composite swap→deposit card is shown (single PTB). One short sentence; user must approve the card.]"
              : "\n\n[A staged swap→deposit card is shown. Note only the swap runs first; deposit is estimated after the swap.]";
        } else if (t === "rebalance_proposal") {
          systemAddendum = "\n\n[A rebalance plan card is shown. Summarize briefly; swaps are not executed automatically.]";
        } else if (t === "trigger_proposal") {
          systemAddendum =
            "\n\n[A scheduled automation trigger card is shown. State when it runs in the user's local timezone; they must Approve Trigger before anything is saved.]";
        } else if (t === "time_info") {
          systemAddendum = "";
        }
      }

      if (
        routed.namespacedName === CREATE_TRIGGER_ACTION_NAME &&
        blocks[0]?.type === "error" &&
        /am or pm/i.test(blocks[0].message)
      ) {
        const amb = text.match(/\b(?:tomorrow|today)\s+at\s+(\d{1,2})\b/i);
        setConversationContext(accountId, chatId, {
          pendingClarification: "schedule_ampm",
          pendingSchedule: {
            partialHour: amb ? parseInt(amb[1], 10) : 8,
            dateLabel: /\btomorrow\b/i.test(text) ? "tomorrow" : "today",
            originalText: text.replace(/\b(?:tomorrow|today)\s+at\s+\d{1,2}\b/i, "").trim(),
          },
        });
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

  if (isLooseRebalanceAsk(lower)) {
    setConversationContext(accountId, chatId, {
      pendingClarification: "rebalance_distribution",
      recentUserIntent: "rebalance_clarify",
    });
    return {
      mode: "deterministic",
      blocks: [],
      caption:
        "What target mix do you want? Example: 30% SUI, 20% WAL, 20% DEEP, and the rest in USDC (percentages should add to 100%).",
    };
  }

  const maybeTargets = parseRebalanceTargets(text);
  const isRebalanceWithTargets =
    maybeTargets &&
    (/\brebalance\b/i.test(lower) ||
      /\btarget\s+allocation\b/i.test(lower) ||
      /\bportfolio\s+mix\b/i.test(lower) ||
      /\badjust\s+my\s+allocation\b/i.test(lower));
  if (isRebalanceWithTargets) {
    try {
      const blocks = await executePackageAction({
        accountId,
        namespacedName: PREPARE_REBALANCE_ACTION_NAME,
        input: { distributionText: text },
      });
      clearConversationField(accountId, chatId, "pendingClarification");
      setConversationContext(accountId, chatId, { recentUserIntent: "rebalance" });
      if (shouldUseDeterministicAssistantReply(blocks)) {
        return { mode: "deterministic", blocks, caption: captionForBlocks(blocks, { network: networkLabel, riskProfile }) };
      }
      return { mode: "llm", blocks, systemAddendum: "\n\n[A rebalance plan card is shown. Summarize briefly.]" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Rebalance plan failed.";
      return { mode: "deterministic", blocks: [{ type: "error", message: msg, code: "action_failed" }], caption: msg };
    }
  }

  if (isPureBestApyQuestion(lower) && env === "mainnet") {
    const poolRows = await assistantDataCache.getNaviPools(env);
    const top = [...poolRows].sort((a, b) => b.supplyApy - a.supplyApy)[0];
    if (top) {
      setConversationContext(accountId, chatId, {
        lastMentionedPool: {
          symbol: top.symbol,
          coinType: top.coinType,
          supplyApy: top.supplyApy,
          decimals: top.decimals,
          assetId: top.assetId,
          poolObjectId: top.poolObjectId,
          reserveId: top.reserveId,
          risk: top.risk,
        },
        lastYieldRecommendation: `${top.symbol} ${top.supplyApy.toFixed(2)}%`,
        recentUserIntent: "best_apy",
      });
    }
    const blocks = await executePackageAction({
      accountId,
      namespacedName: LIST_YIELD_POOLS_ACTION_NAME,
      input: { sortBy: "apy", riskProfile, limit: 5 },
    });
    const caption =
      "Top Navi pools by headline supply APY on the card. Higher APY can mean more token or protocol risk, and rates move.";
    return { mode: "deterministic", blocks, caption };
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

  if (isActivityQuestion(lower)) {
    const items = await assistantDataCache.getActivityPreview(accountId);
    return {
      mode: "deterministic",
      blocks: [],
      caption: formatActivityCaption(items, networkLabel),
    };
  }

  const capabilityHelp = matchCapabilityHelpIntent(text);
  if (capabilityHelp) {
    const blocks = [
      buildAssistantCapabilitiesStructuredResult(
        capabilityHelp.kind === "tool" ? { highlightToolId: capabilityHelp.toolId } : undefined,
      ),
    ];
    return {
      mode: "deterministic",
      blocks,
      caption: buildCapabilityHelpCaption(capabilityHelp),
    };
  }

  return { mode: "llm", blocks: [], systemAddendum: "" };
}
