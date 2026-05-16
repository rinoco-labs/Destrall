import type { SuiChainEnvironment } from "../../../config/chains/sui";
import type { RebalanceSwapLegSnapshot } from "./rebalancePtbBuilder";

export type RebalanceProposalSnapshotV1 = {
  v: 1;
  proposalId: string;
  accountId: string;
  suiEnvironment: SuiChainEnvironment;
  walletAddress: string;
  swapLegs: RebalanceSwapLegSnapshot[];
  preparedAtMs: number;
  expiresAtMs: number;
};
