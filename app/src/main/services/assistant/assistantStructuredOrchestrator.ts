import { randomUUID } from "node:crypto";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { SuiChainEnvironment } from "../../../config/chains/sui";
import type { TokenBalanceView } from "../../../types/blockchain";
import type {
  AssistantProposalCard,
  AssistantStructuredResult,
} from "../../../assistant/assistantResultTypes";
import { chainFacadeService } from "../chains/chainFacadeService";
import { networkSettingsService } from "../network/networkSettingsService";
import { walletService } from "../../wallet/walletService";

function networkDisplay(env: SuiChainEnvironment): string {
  return env.charAt(0).toUpperCase() + env.slice(1);
}

function normalizeUserText(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function tryParseSuiRecipient(fragment: string): string | null {
  const t = fragment.trim();
  if (!t) return null;
  try {
    return normalizeSuiAddress(t);
  } catch {
    return null;
  }
}

function resolveCoinType(balances: TokenBalanceView[], symbol: string): string | null {
  const u = symbol.toUpperCase();
  const row = balances.find((b) => b.symbol.toUpperCase() === u);
  return row?.coinType ?? null;
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
  if (priced.length === balances.length && balances.length > 0) {
    let sum = 0;
    let ok = true;
    for (const b of priced) {
      const n = parseFloat((b.usdValue as string).replace(/[^0-9.-]/g, ""));
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

function buildSwapCard(params: {
  amount: string;
  fromSymbol: string;
  toSymbol: string;
  network: string;
}): AssistantProposalCard {
  return {
    title: "Swap proposal",
    label: `Swap ${params.amount} ${params.fromSymbol} → ${params.toSymbol}`,
    source: { type: "package", name: "CETUS DEX" },
    flows: [
      {
        direction: "out",
        amount: params.amount,
        token: params.fromSymbol,
        kind: "token",
      },
      {
        direction: "in",
        amount: params.toSymbol,
        token: params.toSymbol,
        kind: "token",
      },
    ],
    details: [
      { k: "Action", v: "Token swap (preview)" },
      { k: "From", v: `${params.amount} ${params.fromSymbol}` },
      { k: "To", v: params.toSymbol },
      { k: "Network", v: params.network },
      { k: "Network fee (est.)", v: "—" },
      { k: "Outcome", v: `Exchange ${params.amount} ${params.fromSymbol} for ${params.toSymbol} via DEX routing.` },
    ],
    note:
      "Swaps from the assistant are not executed here yet. Use the in-app swap flow to sign. This card is a structured preview only.",
  };
}

function buildNaviDepositCard(params: {
  amount: string;
  token: string;
  network: string;
}): AssistantProposalCard {
  const receipt = `n${params.token}`;
  return {
    title: "Navi deposit",
    label: `${params.amount} ${params.token}`,
    source: { type: "package", name: "NAVI PROTOCOL" },
    flows: [
      {
        direction: "out",
        amount: params.amount,
        token: params.token,
        kind: "token",
      },
      {
        direction: "in",
        amount: "1",
        token: receipt,
        kind: "object",
        objectName: "Navi supply receipt",
      },
    ],
    details: [
      { k: "Action", v: "Navi supply (preview)" },
      { k: "Token", v: params.token },
      { k: "Amount", v: `${params.amount} ${params.token}` },
      { k: "Protocol", v: "Navi" },
      { k: "Network", v: params.network },
      { k: "Network fee (est.)", v: "—" },
      { k: "Risk (heuristic)", v: "unknown" },
      { k: "Outcome", v: `Supply ${params.amount} ${params.token} to Navi (preview).` },
    ],
    note:
      "Navi supply from the assistant is not signed here yet. Use the Navi package flow when available. This is a preview only.",
  };
}

function buildNaviWithdrawCard(params: {
  amount: string;
  token: string;
  network: string;
}): AssistantProposalCard {
  const receipt = `n${params.token}`;
  return {
    title: "Navi withdraw",
    label: `${params.amount} ${params.token}`,
    source: { type: "package", name: "NAVI PROTOCOL" },
    flows: [
      {
        direction: "in",
        amount: params.amount,
        token: params.token,
        kind: "token",
      },
      {
        direction: "out",
        amount: "1",
        token: receipt,
        kind: "object",
        objectName: "Navi supply receipt",
      },
    ],
    details: [
      { k: "Action", v: "Navi withdraw (redeem supply receipt)" },
      { k: "Token", v: params.token },
      { k: "Amount", v: `${params.amount} ${params.token}` },
      { k: "Protocol", v: "Navi" },
      { k: "Network", v: params.network },
      { k: "Network fee (est.)", v: "—" },
      { k: "Risk (heuristic)", v: "medium" },
      { k: "Outcome", v: `Withdraw ${params.amount} ${params.token} from Navi (preview).` },
    ],
    note:
      "Navi withdrawals from the assistant are not signed here yet. Use the Navi package flow when available. This is a preview only.",
  };
}

async function tryBuildSendProposal(
  accountId: string,
  amount: string,
  symbol: string,
  recipientRaw: string,
  network: string,
): Promise<AssistantStructuredResult[]> {
  const balances = await chainFacadeService.getTokenBalances(accountId);
  const coinType = resolveCoinType(balances, symbol);
  if (!coinType) {
    return [
      {
        type: "error",
        message: `Could not resolve "${symbol}" to a coin in this wallet. Check the symbol and try again.`,
        code: "unknown_token",
      },
    ];
  }

  const recipient = tryParseSuiRecipient(recipientRaw);
  if (!recipient) {
    return [
      {
        type: "error",
        message: "Recipient does not look like a valid Sui address.",
        code: "invalid_recipient",
      },
    ];
  }

  try {
    const account = walletService.getWalletAccount(accountId);
    if (!account || account.chain !== "sui") {
      return [{ type: "error", message: "Only Sui accounts support sends from the assistant." }];
    }
    const prep = await chainFacadeService.prepareTransfer({
      accountId,
      recipient,
      coinType,
      amountDisplay: amount,
    });
    const { summary } = prep;
    const card: AssistantProposalCard = {
      title: "Send",
      label: `Send ${summary.amountFormatted} ${summary.symbol}`,
      source: { type: "core", name: "Destrall Wallet" },
      flows: [
        {
          direction: "out",
          amount: summary.amountFormatted,
          token: summary.symbol,
          kind: "token",
        },
      ],
      details: [
        { k: "Action", v: "Sui transfer" },
        { k: "Token", v: summary.symbol },
        { k: "Amount", v: `${summary.amountFormatted} ${summary.symbol}` },
        { k: "To", v: summary.recipient },
        { k: "Network", v: network },
        {
          k: "Network fee (est.)",
          v: `~${summary.gasBudgetFormatted} SUI`,
        },
        {
          k: "Outcome",
          v: `Send ${summary.amountFormatted} ${summary.symbol} to the recipient address.`,
        },
      ],
      note: "Confirm only if the recipient and amount are correct. Unlock your wallet before approving.",
    };

    const proposalId = randomUUID();
    return [
      {
        type: "send_proposal",
        proposalId,
        status: "pending",
        transferRequestId: prep.transferRequestId,
        card,
      },
    ];
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not prepare transfer.";
    return [{ type: "error", message: msg, code: "prepare_transfer_failed" }];
  }
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
  const network = networkDisplay(env);

  const account = walletService.getWalletAccount(accountId);
  if (!account || account.chain !== "sui") {
    return { blocks: [], systemAddendum: "" };
  }

  const sendMatch = text.match(/\bsend\s+([\d.]+)\s+(\w+)\s+to\s+(.+)/i);
  if (sendMatch) {
    const [, amt, sym, destRaw] = sendMatch;
    const dest = destRaw.trim().replace(/[.,!?;:]+$/, "");
    const blocks = await tryBuildSendProposal(accountId, amt, sym, dest, network);
    const addendum =
      blocks.length > 0
        ? "\n\n[A structured send proposal card is shown. Add at most one short sentence; do not repeat addresses or amounts.]"
        : "";
    return { blocks, systemAddendum: addendum };
  }

  const naviWithdraw = text.match(/\bwithdraw\s+([\d.]+)\s*(\w+)\s+from\s+navi\b/i);
  if (naviWithdraw) {
    const [, amt, tok] = naviWithdraw;
    const proposalId = randomUUID();
    return {
      blocks: [
        {
          type: "navi_withdraw_proposal",
          proposalId,
          status: "pending",
          card: buildNaviWithdrawCard({ amount: amt, token: tok.toUpperCase(), network }),
        },
      ],
      systemAddendum:
        "\n\n[A Navi withdraw preview card is shown. Acknowledge briefly; execution is not from this card yet.]",
    };
  }

  const naviDeposit = text.match(/\bdeposit\s+([\d.]+)\s*(\w+)\s+(?:into|to)\s+navi\b/i);
  if (naviDeposit) {
    const [, amt, tok] = naviDeposit;
    const proposalId = randomUUID();
    return {
      blocks: [
        {
          type: "navi_deposit_proposal",
          proposalId,
          status: "pending",
          card: buildNaviDepositCard({ amount: amt, token: tok.toUpperCase(), network }),
        },
      ],
      systemAddendum:
        "\n\n[A Navi deposit preview card is shown. Acknowledge briefly; execution is not from this card yet.]",
    };
  }

  const swapMatch = text.match(/\bswap\s+([\d.]+)\s+(\w+)\s+(?:to|for)\s+(\w+)\b/i);
  if (swapMatch) {
    const [, amt, from, to] = swapMatch;
    const proposalId = randomUUID();
    return {
      blocks: [
        {
          type: "swap_proposal",
          proposalId,
          status: "pending",
          card: buildSwapCard({
            amount: amt,
            fromSymbol: from.toUpperCase(),
            toSymbol: to.toUpperCase(),
            network,
          }),
        },
      ],
      systemAddendum:
        "\n\n[A swap preview card is shown. Acknowledge briefly; signing swaps from the assistant is not enabled yet.]",
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

  const yieldPosRe =
    /\byield positions?\b|\bdefi positions?\b|\bstaking positions?\b|\bwhere.*earning\b|\bnavi position/i;
  if (yieldPosRe.test(lower)) {
    return {
      blocks: [
        {
          type: "yield_positions",
          network,
          positions: [],
          emptyHint: "Live yield positions are not synced in the assistant yet. Check protocol apps for open positions.",
        },
      ],
      systemAddendum:
        "\n\n[An empty yield positions card is shown. Explain that live DeFi positions are not connected yet.]",
    };
  }

  const poolsRe =
    /\byield pools?\b|\bavailable pools?\b|\blending pools?\b|\bwhat pools\b|\bsupply apy\b|\bearn on\b/i;
  if (poolsRe.test(lower)) {
    return {
      blocks: [
        {
          type: "available_yield_pools",
          network,
          protocolLabel: "NAVI PROTOCOL",
          pools: [],
          emptyHint:
            "Pool APY and TVL feeds are not connected in the assistant yet. Open Navi or your protocol of choice for live rates.",
        },
      ],
      systemAddendum:
        "\n\n[An empty yield pools card is shown. Explain that live pool data is not wired yet — no fabricated APY or TVL.]",
    };
  }

  const swapTokensRe =
    /\bwhat tokens can i trade\b|\bavailable tokens\b|\bwhat can i swap\b|\bswappable\b|\btradable tokens\b/i;
  if (swapTokensRe.test(lower)) {
    const balances = await chainFacadeService.getTokenBalances(accountId);
    const coins = balances.map((b) => ({
      symbol: b.symbol,
      name: b.symbol,
      network,
      coinType: b.coinType,
    }));
    return {
      blocks: [
        {
          type: "swappable_tokens",
          network,
          routerLabel: "Wallet tokens (router not connected)",
          coins,
          emptyHint:
            coins.length === 0
              ? "No token balances to show. Fund this account or adjust the query."
              : "DEX router token lists are not connected yet — showing symbols from your wallet only (no liquidity quotes).",
        },
      ],
      systemAddendum:
        "\n\n[A swappable tokens card lists wallet tokens only; explain that router/DEX liquidity data is not connected yet.]",
    };
  }

  return { blocks: [], systemAddendum: "" };
}
