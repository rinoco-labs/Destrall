import { randomUUID } from "node:crypto";
import type { AssistantStructuredResult } from "../../../assistant/assistantResultTypes";
import type { ActionContext } from "../../runtime/actionContext";
import { validateChainFeeConfig, getChainTreasuryAddress, getSwapFeeBps } from "../../../config/destrall.config";
import { formatTokenAmount } from "../../../main/services/chains/sui/sui-balance.service";
import { suiAftermathSwapService } from "../../../main/services/chains/sui/sui-aftermath-swap.service";
import { normalizeSuiCoinType } from "../../../main/services/chains/sui/sui-coin-type-normalize";
import { fetchAftermathSupportedCoinTypes } from "./aftermath-router.service";
import {
  enrichTokenMetadata,
  getSwappableTokens,
  resolveSwappableToken,
} from "../../../services/tokens/swappableTokenRegistry";
import {
  listSwappableTokensInputSchema,
  prepareSwapInputSchema,
} from "./swap.schemas";
import { buildSwapProposalAssistantCard, buildSwapProposalSnapshot } from "./swapProposalBuilder";
import { assertSwapSpendWithinBalance, resolveSpendTokenFromWallet } from "./swapTokenResolver";
import type { SwappableTokenView } from "./swap.types";

const DEFAULT_SLIPPAGE_BPS = 50;

export async function listSwappableTokensAction(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  const parsed = listSwappableTokensInputSchema.safeParse(input);
  if (!parsed.success) {
    return [{ type: "error", message: "Invalid request.", code: "invalid_input" }];
  }

  const account = ctx.wallet.getActiveAccount();
  if (!account || account.chain !== "sui") {
    return [{ type: "error", message: "Only Sui accounts support swaps from the assistant.", code: "unsupported_chain" }];
  }

  const net = ctx.network.getActiveNetwork();
  if (net.environment === "devnet") {
    return [{ type: "error", message: "Swaps are not supported on Devnet.", code: "unsupported_network" }];
  }

  try {
    const supported = await fetchAftermathSupportedCoinTypes(net.environment);
    const supportedSet = new Set(supported);

    const q = parsed.data.query?.trim().toLowerCase() ?? "";

    const base = getSwappableTokens("sui");
    const coins: SwappableTokenView[] = [];

    for (const row of base) {
      try {
        const enriched = await enrichTokenMetadata("sui", row, net.environment);
        if (q) {
          const hay = `${enriched.symbol} ${enriched.name} ${enriched.coinType}`.toLowerCase();
          if (!hay.includes(q)) continue;
        }
        coins.push({
          symbol: enriched.symbol,
          name: enriched.name,
          coinType: enriched.coinType,
          decimals: enriched.decimals,
          iconUrl: enriched.iconUrl,
          network: net.displayName,
          routerStatus: supportedSet.has(normalizeSuiCoinType(enriched.coinType))
            ? "Supported"
            : "Not listed",
        });
      } catch {
        if (!q || row.symbol.toLowerCase().includes(q) || row.name.toLowerCase().includes(q)) {
          coins.push({
            symbol: row.symbol,
            name: row.name,
            coinType: row.coinType,
            network: net.displayName,
            routerStatus: supportedSet.has(normalizeSuiCoinType(row.coinType))
              ? "Supported"
              : "Not listed",
          });
        }
      }
    }

    return [
      {
        type: "swappable_tokens",
        network: net.displayName,
        routerLabel: "Destrall · Aftermath",
        coins: coins.map((c) => ({
          symbol: c.symbol,
          name: c.name ?? c.symbol,
          network: c.network,
          liquidityUsd: c.liquidityUsd,
          routerStatus: c.routerStatus,
          coinType: c.coinType,
          decimals: c.decimals,
          iconUrl: c.iconUrl,
        })),
        emptyHint: coins.length ? undefined : "No tokens matched that search.",
      },
    ];
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load swappable tokens.";
    return [{ type: "error", message: msg, code: "aftermath_tokens_failed" }];
  }
}

export async function prepareSwapAction(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  const parsed = prepareSwapInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid swap request.";
    return [{ type: "error", message: first, code: "invalid_input" }];
  }

  const account = ctx.wallet.getActiveAccount();
  if (!account || account.chain !== "sui") {
    return [{ type: "error", message: "Only Sui accounts support swaps from the assistant.", code: "unsupported_chain" }];
  }

  const net = ctx.network.getActiveNetwork();
  if (net.environment === "devnet") {
    return [{ type: "error", message: "Swaps are not supported on Devnet.", code: "unsupported_network" }];
  }

  const balances = await ctx.wallet.getBalances();
  const fromPick = resolveSpendTokenFromWallet({ userToken: parsed.data.fromToken, balances });
  if (fromPick.kind === "error") {
    return [{ type: "error", message: fromPick.message, code: "insufficient_funds" }];
  }

  const spendOk = assertSwapSpendWithinBalance({
    amountDisplay: parsed.data.amount,
    decimals: fromPick.balance.decimals,
    balance: fromPick.balance,
  });
  if (spendOk.ok === false) {
    return [{ type: "error", message: spendOk.message, code: "insufficient_funds" }];
  }

  const toEntry = resolveSwappableToken("sui", parsed.data.toToken);
  if (!toEntry) {
    return [
      {
        type: "error",
        message: `${parsed.data.toToken.trim()} is not currently available for swaps on ${net.displayName}.`,
        code: "unsupported_token",
      },
    ];
  }

  let enrichedTo;
  try {
    enrichedTo = await enrichTokenMetadata("sui", toEntry, net.environment);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load token metadata.";
    return [{ type: "error", message: msg, code: "token_metadata_failed" }];
  }

  const coinInNorm = normalizeSuiCoinType(fromPick.balance.coinType);
  const coinOutNorm = normalizeSuiCoinType(enrichedTo.coinType);
  if (coinInNorm === coinOutNorm) {
    return [{ type: "error", message: "Choose two different tokens to swap.", code: "same_asset" }];
  }

  const supported = await fetchAftermathSupportedCoinTypes(net.environment);
  const supportedSet = new Set(supported);
  if (!supportedSet.has(coinInNorm)) {
    return [
      {
        type: "error",
        message: `${fromPick.balance.symbol} is not currently available for swaps on ${net.displayName}.`,
        code: "unsupported_token",
      },
    ];
  }
  if (!supportedSet.has(coinOutNorm)) {
    return [
      {
        type: "error",
        message: `${enrichedTo.symbol} is not currently available for swaps on ${net.displayName}.`,
        code: "unsupported_token",
      },
    ];
  }

  const slippageBps = parsed.data.slippageBps ?? DEFAULT_SLIPPAGE_BPS;

  const feeOk = validateChainFeeConfig("sui");
  const treasury = feeOk ? getChainTreasuryAddress("sui") : undefined;
  const appFeeBps = feeOk ? Number.parseInt(getSwapFeeBps("sui"), 10) || 0 : 0;
  const externalFee =
    feeOk && treasury && appFeeBps > 0
      ? { recipient: treasury, feePercentage: appFeeBps / 10_000 }
      : undefined;

  const riskWarnings: string[] = [];
  if (slippageBps > 200) {
    riskWarnings.push("Slippage is set higher than usual; you may receive less than quoted.");
  }

  try {
    const quote = await suiAftermathSwapService.prepareSwapQuote({
      env: net.environment,
      walletAddress: account.address,
      coinInType: fromPick.balance.coinType,
      coinOutType: enrichedTo.coinType,
      amountDisplay: parsed.data.amount,
      coinInDecimals: fromPick.balance.decimals,
      fromSymbol: fromPick.balance.symbol,
      toSymbol: enrichedTo.symbol,
      slippageBps,
      externalFee,
    });

    const inputAmountFormatted = formatTokenAmount(quote.coinInAmountRaw, fromPick.balance.decimals);
    const outputAmountFormatted = formatTokenAmount(quote.estimatedOutRaw, enrichedTo.decimals);

    const snapshot = buildSwapProposalSnapshot({
      accountId: ctx.accountId,
      suiEnvironment: net.environment,
      walletAddress: account.address,
      fromCoinType: coinInNorm,
      toCoinType: coinOutNorm,
      fromSymbol: fromPick.balance.symbol,
      toSymbol: enrichedTo.symbol,
      amountDisplay: parsed.data.amount.trim(),
      coinInAmountRaw: quote.coinInAmountRaw.toString(),
      estimatedOutRaw: quote.estimatedOutRaw.toString(),
      slippageBps,
      appFeeBps,
      treasuryAddress: externalFee?.recipient,
      quoteExpiresAtMs: quote.quoteExpiresAtMs,
      route: quote.route,
    });

    const card = buildSwapProposalAssistantCard({
      inputAmountFormatted,
      outputAmountFormatted,
      fromSymbol: fromPick.balance.symbol,
      toSymbol: enrichedTo.symbol,
      networkLabel: net.displayName,
      routeSummary: quote.routeSummary,
      priceImpactLabel: quote.priceImpactLabel,
      slippageBps,
      appFeeBps,
      treasuryAddress: externalFee?.recipient,
      gasBudgetFormatted: quote.gasBudgetFormatted,
      riskWarnings,
    });

    const proposalId = randomUUID();
    return [
      {
        type: "swap_proposal",
        proposalId,
        status: "pending",
        proposalSnapshot: snapshot,
        card,
      },
    ];
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not prepare swap.";
    if (/Insufficient/i.test(msg)) {
      return [{ type: "error", message: `You do not have enough ${fromPick.balance.symbol} to swap.`, code: "insufficient_funds" }];
    }
    return [{ type: "error", message: msg, code: "prepare_swap_failed" }];
  }
}

export async function executeSwapAction(
  _input: Record<string, unknown>,
  _ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  void _input;
  void _ctx;
  return [
    {
      type: "error",
      message: "Swaps are executed only after you tap Approve on the swap card.",
      code: "swap_execute_via_ui",
    },
  ];
}
