import type { AssistantProposalCard } from "../../../assistant/assistantResultTypes";
import type { SwapProposalSnapshotV1 } from "./swap.types";
import type { AftermathTradeRoute } from "../../../main/services/chains/sui/aftermath-router-api";
import { serializeAftermathRoute } from "../../../main/services/chains/sui/sui-aftermath-swap.service";
import { formatSlippageBpsForDisplay } from "../../../shared/swap/slippage";

function formatAppFeeLine(appFeeBps: number, treasury?: string): string {
  const pct = appFeeBps / 100;
  if (appFeeBps <= 0 || !treasury) return "None";
  const short = `${treasury.slice(0, 10)}…${treasury.slice(-6)}`;
  return `${pct.toFixed(2)}% → ${short}`;
}

export function buildSwapProposalSnapshot(params: {
  accountId: string;
  suiEnvironment: SwapProposalSnapshotV1["suiEnvironment"];
  walletAddress: string;
  fromCoinType: string;
  toCoinType: string;
  fromSymbol: string;
  toSymbol: string;
  amountDisplay: string;
  coinInAmountRaw: string;
  estimatedOutRaw: string;
  slippageBps: number;
  appFeeBps: number;
  treasuryAddress?: string;
  quoteExpiresAtMs: number;
  route: AftermathTradeRoute;
}): SwapProposalSnapshotV1 {
  return {
    v: 1,
    accountId: params.accountId,
    suiEnvironment: params.suiEnvironment,
    walletAddress: params.walletAddress,
    fromCoinType: params.fromCoinType,
    toCoinType: params.toCoinType,
    fromSymbol: params.fromSymbol,
    toSymbol: params.toSymbol,
    amountDisplay: params.amountDisplay,
    coinInAmountRaw: params.coinInAmountRaw,
    estimatedOutRaw: params.estimatedOutRaw,
    slippageBps: params.slippageBps,
    appFeeBps: params.appFeeBps,
    treasuryAddress: params.treasuryAddress,
    quoteExpiresAtMs: params.quoteExpiresAtMs,
    completeRouteJson: serializeAftermathRoute(params.route),
  };
}

export function buildSwapProposalAssistantCard(params: {
  inputAmountFormatted: string;
  outputAmountFormatted: string;
  fromSymbol: string;
  toSymbol: string;
  networkLabel: string;
  routeSummary: string;
  priceImpactLabel: string;
  slippageBps: number;
  appFeeBps: number;
  treasuryAddress?: string;
  gasBudgetFormatted: string;
  quoteExpiresAtMs?: number;
  riskWarnings: string[];
}): AssistantProposalCard {
  const noteLines = [
    "Confirm only if amounts and tokens look correct. Unlock your wallet before approving.",
    ...params.riskWarnings,
  ];

  return {
    title: "Swap",
    label: `Swap ${params.inputAmountFormatted} ${params.fromSymbol} → ${params.outputAmountFormatted} ${params.toSymbol}`,
    source: { type: "package", name: "Aftermath Swap" },
    flows: [
      {
        direction: "out",
        amount: params.inputAmountFormatted,
        token: params.fromSymbol,
        kind: "token",
      },
      {
        direction: "in",
        amount: params.outputAmountFormatted,
        token: params.toSymbol,
        kind: "token",
      },
    ],
    details: [
      { k: "Action", v: "Swap" },
      { k: "From", v: params.fromSymbol },
      { k: "To", v: params.toSymbol },
      { k: "Amount in", v: `${params.inputAmountFormatted} ${params.fromSymbol}` },
      { k: "Estimated amount out", v: `${params.outputAmountFormatted} ${params.toSymbol}` },
      { k: "Price impact / fees", v: params.priceImpactLabel },
      { k: "Route", v: params.routeSummary },
      { k: "Network", v: params.networkLabel },
      { k: "Slippage tolerance", v: formatSlippageBpsForDisplay(params.slippageBps) },
      { k: "App fee", v: formatAppFeeLine(params.appFeeBps, params.treasuryAddress) },
      { k: "Estimated gas", v: `~${params.gasBudgetFormatted} SUI` },
      ...(params.quoteExpiresAtMs
        ? [
            {
              k: "Quote expires",
              v: new Date(params.quoteExpiresAtMs).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              }),
            },
          ]
        : []),
    ],
    note: noteLines.join(" "),
  };
}
