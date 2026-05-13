import type { SuiChainEnvironment } from "../../../config/chains/sui";
import type { TokenBalanceView } from "../../../types/blockchain";
import type {
  AssistantStructuredResult,
} from "../../../assistant/assistantResultTypes";
import {
  classifySwapUserMessage,
  tryRouteAssistantToolCall,
} from "../../../assistant/assistantToolRouter";
import { executePackageAction } from "../../../packages/runtime/actionExecutor";
import { chainFacadeService } from "../chains/chainFacadeService";
import { networkSettingsService } from "../network/networkSettingsService";
import { walletService } from "../../wallet/walletService";

function networkDisplay(env: SuiChainEnvironment): string {
  return env.charAt(0).toUpperCase() + env.slice(1);
}

function normalizeUserText(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function portfolioFromBalances(
  env: SuiChainEnvironment,
  balances: TokenBalanceView[],
): AssistantStructuredResult {
  const network = networkDisplay(env);
  const assets = balances.map((b) => ({
    symbol: b.symbol,
    name: b.symbol,
    balanceFormatted: b.balanceFormatted,
    valueUsd: b.usdValue,
    coinType: b.coinType,
  }));

  let totalUsd: string | undefined;
  const priced = balances.filter((b) => b.usdValue != null && b.usdValue !== "");
  if (priced.length > 0) {
    let sum = 0;
    let ok = true;
    for (const b of priced) {
      const n = Number.parseFloat((b.usdValue as string).replace(/[^0-9.-]/g, ""));
      if (Number.isNaN(n)) {
        ok = false;
        break;
      }
      sum += n;
    }
    if (ok) totalUsd = sum.toFixed(2);
  }

  return {
    type: "portfolio_summary",
    network,
    totalUsd,
    assets,
  };
}

/**
 * Deterministic structured UI blocks for the last user message.
 * Does not call the LLM; pairs with assistant inference for short prose.
 */
export async function buildAssistantStructuredBlocks(
  accountId: string,
  userText: string,
): Promise<{ blocks: AssistantStructuredResult[]; systemAddendum: string }> {
  const text = normalizeUserText(userText);
  const lower = text.toLowerCase();
  const env = networkSettingsService.getSuiEnvironment();

  const account = walletService.getWalletAccount(accountId);
  if (!account || account.chain !== "sui") {
    return { blocks: [], systemAddendum: "" };
  }

  const routed = tryRouteAssistantToolCall(text);
  if (routed) {
    try {
      const blocks = await executePackageAction({
        accountId,
        namespacedName: routed.namespacedName,
        input: routed.input,
      });
      let addendum = "";
      if (blocks.length > 0) {
        const t = blocks[0]?.type;
        if (t === "send_proposal" || t === "contact_disambiguation") {
          addendum =
            "\n\n[A structured send or contact-choice card is shown. Add at most one short sentence; do not repeat addresses or amounts.]";
        } else if (t === "swap_proposal") {
          addendum =
            "\n\n[A swap review card is shown. Add at most one short sentence; do not repeat quoted amounts or routes.]";
        } else if (t === "swappable_tokens") {
          addendum =
            "\n\n[A Sui-only swappable-token list card is shown (app registry). Summarize briefly; do not read every line aloud.]";
        } else if (t === "available_yield_pools") {
          addendum =
            "\n\n[A Navi yield pools card is shown with live APY when available. Summarize briefly; do not invent rates.]";
        } else if (t === "yield_positions") {
          addendum =
            "\n\n[A Navi yield positions card is shown. Summarize briefly; do not claim positions the card does not list.]";
        } else if (t === "navi_deposit_proposal" || t === "navi_withdraw_proposal") {
          addendum =
            "\n\n[A Navi transaction review card is shown. Add at most one short sentence; execution only after user approves.]";
        }
      }
      return { blocks, systemAddendum: addendum };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Action failed.";
      return {
        blocks: [{ type: "error", message: msg, code: "action_failed" }],
        systemAddendum: "",
      };
    }
  }

  const swapGap = classifySwapUserMessage(text);
  if (swapGap === "missing_to") {
    return {
      blocks: [
        {
          type: "error",
          message: "What token do you want to receive?",
          code: "swap_incomplete",
        },
      ],
      systemAddendum: "",
    };
  }
  if (swapGap === "missing_amount" || swapGap === "incomplete") {
    return {
      blocks: [
        {
          type: "error",
          message: "I need an amount, from token, and to token to prepare a swap.",
          code: "swap_incomplete",
        },
      ],
      systemAddendum: "",
    };
  }

  const portfolioRe =
    /\bportfolio\b|\bholdings\b|\bmy tokens\b|\bwhat assets\b|\bwhat do i have\b|\bshow my (tokens|balances)\b|\bportfolio worth\b|\bbalances?\b/i;
  if (portfolioRe.test(lower)) {
    const balances = await chainFacadeService.getTokenBalances(accountId);
    const block = portfolioFromBalances(env, balances);
    return {
      blocks: [block],
      systemAddendum:
        "\n\n[A portfolio card with live balances is shown. Summarize briefly; do not duplicate the token table.]",
    };
  }

  return { blocks: [], systemAddendum: "" };
}
