import type { AssistantProposalCard } from "../../../../assistant/assistantResultTypes";
import type { NaviYieldProposalSnapshotV1 } from "./navi.types";

export function buildNaviDepositProposalCard(params: {
  assetSymbol: string;
  amountDisplay: string;
  networkLabel: string;
  apyPct: number;
  gasBudgetFormatted: string;
  riskLabel: string;
}): AssistantProposalCard {
  const apyStr = `${params.apyPct.toFixed(2)}%`;
  return {
    title: "Navi deposit",
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
      { k: "Action", v: "Navi Deposit" },
      { k: "Asset", v: params.assetSymbol },
      { k: "Amount", v: `${params.amountDisplay} ${params.assetSymbol}` },
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
    note: "Rates and gas are estimates. Approving builds and signs a real transaction on Sui.",
  };
}

export function buildNaviWithdrawProposalCard(params: {
  assetSymbol: string;
  amountDisplay: string;
  networkLabel: string;
  apyPct: number;
  gasBudgetFormatted: string;
  positionSummary?: string;
}): AssistantProposalCard {
  const apyStr = `${params.apyPct.toFixed(2)}%`;
  return {
    title: "Navi withdraw",
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
      { k: "Action", v: "Navi Withdraw" },
      { k: "Asset", v: params.assetSymbol },
      { k: "Amount", v: `${params.amountDisplay} ${params.assetSymbol}` },
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
