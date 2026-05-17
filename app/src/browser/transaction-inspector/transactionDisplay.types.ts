export type TransactionCategory =
  | "send"
  | "swap"
  | "yield_deposit"
  | "yield_withdraw"
  | "rebalance"
  | "trigger_execution"
  | "contract_interaction"
  | "nft"
  | "connect"
  | "disconnect"
  | "sign_message"
  | "unknown";

export type RiskSeverity = "info" | "warning" | "critical";

export type TransactionRiskWarning = {
  id: string;
  severity: RiskSeverity;
  title: string;
  description: string;
};

export type AssetMovement = {
  direction: "send" | "receive";
  amount: string;
  symbol: string;
  coinType?: string;
};

export type TransactionStep = {
  index: number;
  title: string;
  detail?: string;
};

export type FeeEstimate = {
  label: string;
  amount: string;
  note?: string;
};

export type DappIdentity = {
  origin: string;
  hostname: string;
  displayName: string;
  faviconUrl?: string;
};

export type SimulationBalanceChange = {
  coinType: string;
  amount: string;
  owner?: string;
};

export type SimulationResult = {
  ok: boolean;
  gasEstimate?: string;
  errorMessage?: string;
  balanceChanges?: SimulationBalanceChange[];
};

export type TransactionApprovalView = {
  kind: "connect" | "disconnect" | "sign_message" | "sign_transaction" | "sign_and_execute";
  category: TransactionCategory;
  title: string;
  headline: string;
  subheadline?: string;
  dapp: DappIdentity;
  accountLabel: string;
  accountAddress: string;
  networkLabel: string;
  parseConfidence: "high" | "medium" | "low";
  decoded: boolean;
  youSend: AssetMovement[];
  youReceive: AssetMovement[];
  steps: TransactionStep[];
  fees: FeeEstimate[];
  warnings: TransactionRiskWarning[];
  messagePreview?: string;
  simulation?: SimulationResult;
  advancedPayload: string;
};

export type InspectApprovalInput = {
  method: string;
  origin: string;
  payload?: unknown;
  accountLabel: string;
  accountAddress: string;
  networkLabel: string;
};
