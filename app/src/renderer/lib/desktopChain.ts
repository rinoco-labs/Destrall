import type {
  ChainNetworkStatePayload,
  DailyBriefChainBundle,
  RpcResult,
} from "../../shared/ipc";
import type { DailyBriefAssistantMemoryPayload } from "../../shared/dailyBriefMemory";
import type {
  ChainActivityPage,
  SwapExecuteResult,
  TokenBalanceView,
  TransferExecuteResult,
  TransferPrepareResult,
} from "../../types/blockchain";
import type { SwapProposalSnapshotV1 } from "@packages/core/swap/swap.types";
import type { NaviYieldProposalSnapshotV1 } from "@packages/core/yield/navi/navi.types";
import type { CompositeProposalSnapshotV1 } from "@packages/runtime/composite/compositeTypes";
import type { RebalanceProposalSnapshotV1 } from "@packages/core/rebalance/rebalance.types";
import type { ChainId } from "../../shared/wallet/types";
import type { SuiChainEnvironment } from "../../config/chains/sui";

function api() {
  if (typeof window === "undefined" || !window.destrallApi) {
    throw new Error("Destrall API is not available in this context.");
  }
  return window.destrallApi;
}

async function unwrap<T>(result: Promise<RpcResult<T>>): Promise<T> {
  const response = await result;
  if (response.ok === false) {
    throw new Error(response.error);
  }
  return response.data;
}

export async function desktopGetChainNetworkState(): Promise<ChainNetworkStatePayload> {
  return unwrap(api().chain.getNetworkState());
}

export async function desktopSetChainNetwork(payload: {
  activeChain: ChainId;
  suiEnvironment: SuiChainEnvironment;
}): Promise<ChainNetworkStatePayload> {
  return unwrap(api().chain.setNetwork(payload));
}

export async function desktopGetChainBalances(accountId: string): Promise<TokenBalanceView[]> {
  return unwrap(api().chain.getBalances(accountId));
}

export async function desktopGetChainActivity(payload: {
  accountId: string;
  cursor?: string | null;
}): Promise<ChainActivityPage> {
  return unwrap(api().chain.getActivity(payload));
}

export async function desktopPrepareTransfer(payload: {
  accountId: string;
  recipient: string;
  coinType: string;
  amountDisplay: string;
  walletDecimals?: number;
  walletBalanceRaw?: string;
  walletSymbol?: string;
}): Promise<TransferPrepareResult> {
  return unwrap(api().chain.prepareTransfer(payload));
}

export async function desktopConfirmTransfer(transferRequestId: string): Promise<TransferExecuteResult> {
  return unwrap(api().chain.confirmTransfer({ transferRequestId }));
}

export async function desktopExecuteSwap(payload: {
  accountId: string;
  proposalSnapshot: SwapProposalSnapshotV1;
}): Promise<SwapExecuteResult> {
  return unwrap(api().chain.executeSwap(payload));
}

export async function desktopExecuteNaviYield(payload: {
  accountId: string;
  proposalSnapshot: NaviYieldProposalSnapshotV1;
}): Promise<SwapExecuteResult> {
  return unwrap(api().chain.executeNaviYield(payload));
}

export async function desktopExecuteComposite(payload: {
  accountId: string;
  proposalSnapshot: CompositeProposalSnapshotV1;
}): Promise<SwapExecuteResult> {
  return unwrap(api().chain.executeComposite(payload));
}

export async function desktopExecuteRebalance(payload: {
  accountId: string;
  proposalSnapshot: RebalanceProposalSnapshotV1;
}): Promise<SwapExecuteResult> {
  return unwrap(api().chain.executeRebalance(payload));
}

export async function desktopGetDailyBriefChainBundle(accountId: string): Promise<DailyBriefChainBundle> {
  return unwrap(api().chain.getDailyBriefChainBundle(accountId));
}

export async function desktopPublishDailyBriefMemory(payload: {
  accountId: string;
  memory: DailyBriefAssistantMemoryPayload;
}): Promise<{ ok: true }> {
  return unwrap(api().chain.publishDailyBriefMemory(payload));
}

export function subscribeChainNetworkChanged(listener: () => void): () => void {
  if (typeof window === "undefined" || !window.destrallApi) {
    return () => undefined;
  }
  return window.destrallApi.chain.onNetworkChanged(listener);
}
