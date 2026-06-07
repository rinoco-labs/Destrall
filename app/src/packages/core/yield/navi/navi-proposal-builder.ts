import type { AssistantProposalCard } from "../../../../assistant/assistantResultTypes";
import type { NaviYieldProposalSnapshotV1 } from "./navi.types";

export function buildNaviDepositProposalCard(params: {
  assetSymbol: string;
  amountDisplay: string;
  networkLabel: string;
  apyPct: number;
  gasBudgetFormatted: string;
  riskLabel: string;
  walletBalanceDisplay?: string;
  decimals?: number;
  userPhrase?: string;
}): AssistantProposalCard {
  const apyStr = `${params.apyPct.toFixed(2)}%`;
  return {
    title: "Deposit into Navi",
    label: `${params.amountDisplay} ${params.assetSymbol}`,
    source: { type: "package", name: "NAVI PROTOCOL" },
    flows: [
      { direction: "out", amount: params.amountDisplay, token: params.assetSymbol, kind: "token" },
      {
        direction: "in",
        amount: "—",
        token: params.assetSymbol,
        kind: "object",
        objectName: "Navi supply position",
      },
    ],
    details: [
      { k: "Action", v: "Deposit into Navi" },
      ...(params.userPhrase ? [{ k: "Requested as", v: params.userPhrase } as const] : []),
      { k: "Asset", v: params.assetSymbol },
      { k: "Amount", v: `${params.amountDisplay} ${params.assetSymbol}` },
      ...(params.decimals != null ? [{ k: "Decimals", v: String(params.decimals) } as const] : []),
      ...(params.walletBalanceDisplay
        ? [{ k: "Wallet balance", v: `${params.walletBalanceDisplay} ${params.assetSymbol}` } as const]
        : []),
      { k: "Navi pool", v: params.assetSymbol },
      { k: "Supply APY (indicative)", v: apyStr },
      { k: "Protocol", v: "Navi" },
      { k: "Network", v: params.networkLabel },
      { k: "Network fee (est.)", v: `${params.gasBudgetFormatted} SUI` },
      { k: "Risk", v: params.riskLabel },
      {
        k: "Expected outcome",
        v: `Supply ${params.amountDisplay} ${params.assetSymbol} into Navi lending on ${params.networkLabel}.`,
      },
    ],
    note: "APY is indicative and can change. Rates and gas are estimates. Approving builds and signs a real transaction on Sui.",
  };
}

export function buildNaviWithdrawProposalCard(params: {
  assetSymbol: string;
  amountDisplay: string;
  networkLabel: string;
  apyPct: number;
  gasBudgetFormatted: string;
  positionSummary?: string;
  suppliedBalanceDisplay?: string;
  userPhrase?: string;
}): AssistantProposalCard {
  const apyStr = `${params.apyPct.toFixed(2)}%`;
  return {
    title: "Withdraw from Navi",
    label: `${params.amountDisplay} ${params.assetSymbol}`,
    source: { type: "package", name: "NAVI PROTOCOL" },
    flows: [
      {
        direction: "in",
        amount: params.amountDisplay,
        token: params.assetSymbol,
        kind: "token",
      },
      { direction: "out", amount: "—", token: params.assetSymbol, kind: "object", objectName: "Navi position" },
    ],
    details: [
      { k: "Action", v: "Withdraw from Navi" },
      ...(params.userPhrase ? [{ k: "Requested as", v: params.userPhrase } as const] : []),
      { k: "Asset", v: params.assetSymbol },
      { k: "Amount", v: `${params.amountDisplay} ${params.assetSymbol}` },
      ...(params.suppliedBalanceDisplay
        ? [{ k: "Supplied balance", v: `${params.suppliedBalanceDisplay} ${params.assetSymbol}` } as const]
        : []),
      { k: "Protocol", v: "Navi" },
      { k: "Supply APY (position)", v: apyStr },
      { k: "Network", v: params.networkLabel },
      { k: "Network fee (est.)", v: `${params.gasBudgetFormatted} SUI` },
      ...(params.positionSummary ? [{ k: "Position", v: params.positionSummary } as const] : []),
      {
        k: "Expected outcome",
        v: `Withdraw ${params.amountDisplay} ${params.assetSymbol} from Navi to your wallet.`,
      },
    ],
    note: "Approving builds and signs a real transaction on Sui.",
  };
}

export function buildNaviYieldProposalSnapshot(params: NaviYieldProposalSnapshotV1): NaviYieldProposalSnapshotV1 {
  return params;
}
