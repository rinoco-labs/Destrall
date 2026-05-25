import type { ChainId } from "../../../shared/wallet/types";
import type {
  ChainActivityPage,
  NetworkUiSnapshot,
  SwapExecuteResult,
  TokenBalanceView,
  TransferExecuteResult,
  TransferPrepareResult,
} from "../../../types/blockchain";
import type { SuiChainEnvironment } from "../../../config/chains/sui";
import { networkSettingsService } from "../network/networkSettingsService";
import { walletService } from "../../wallet/walletService";
import { clearSuiClientCache, getSuiClientForEnvironment } from "./sui/sui-client.service";
import { clearSuinsClientCache } from "../../../services/suins/suinsResolutionService";
import { SuiTokenMetadataService } from "./sui/sui-token-metadata.service";
import { fetchSuiBalancesForAddress } from "./sui/sui-balance.service";
import { enrichSuiBalancesWithAftermathUsd } from "./sui/sui-aftermath-prices.service";
import { fetchSuiActivityPage } from "./sui/sui-activity.service";
import { SuiTransferService } from "./sui/sui-transfer.service";
import type { SwapProposalSnapshotV1 } from "@packages/core/swap/swap.types";
import type { CompositeProposalSnapshotV1 } from "@packages/runtime/composite/compositeTypes";
import type { RebalanceProposalSnapshotV1 } from "@packages/core/rebalance/rebalance.types";
import { executeCompositeProposal } from "@packages/runtime/composite/compositeExecutor";
import { executeRebalanceProposal } from "@packages/core/rebalance/rebalanceExecutor";
import { suiAftermathSwapService } from "./sui/sui-aftermath-swap.service";

class ChainFacadeService {
  getNetworkSnapshot(): NetworkUiSnapshot {
    return networkSettingsService.getSnapshot();
  }

  setSuiNetwork(environment: SuiChainEnvironment) {
    networkSettingsService.setSuiEnvironment(environment);
    clearSuiClientCache();
    clearSuinsClientCache();
  }

  setActiveChain(chain: ChainId) {
    networkSettingsService.setActiveChain(chain);
    clearSuiClientCache();
    clearSuinsClientCache();
  }

  async getTokenBalances(accountId: string): Promise<TokenBalanceView[]> {
    const account = walletService.getWalletAccount(accountId);
    if (!account || account.chain !== "sui") {
      return [];
    }
    const env = networkSettingsService.getSuiEnvironment();
    const client = getSuiClientForEnvironment(env);
    const meta = new SuiTokenMetadataService(() => getSuiClientForEnvironment(env));
    const rows = await fetchSuiBalancesForAddress(client, meta, account.address);
    return enrichSuiBalancesWithAftermathUsd(env, rows);
  }

  async getActivityPage(accountId: string, cursor?: string | null): Promise<ChainActivityPage> {
    const account = walletService.getWalletAccount(accountId);
    if (!account || account.chain !== "sui") {
      return { items: [], nextCursor: null };
    }
    const env = networkSettingsService.getSuiEnvironment();
    const client = getSuiClientForEnvironment(env);
    const meta = new SuiTokenMetadataService(() => getSuiClientForEnvironment(env));
    return fetchSuiActivityPage({
      client,
      metadata: meta,
      address: account.address,
      environment: env,
      cursor,
      limit: 25,
    });
  }

  private getTransferService(): SuiTransferService {
    const env = networkSettingsService.getSuiEnvironment();
    return new SuiTransferService(
      () => getSuiClientForEnvironment(env),
      () => networkSettingsService.getSuiEnvironment(),
      () => new SuiTokenMetadataService(() => getSuiClientForEnvironment(networkSettingsService.getSuiEnvironment())),
    );
  }

  async prepareTransfer(params: {
    accountId: string;
    recipient: string;
    coinType: string;
    amountDisplay: string;
  }): Promise<TransferPrepareResult> {
    const account = walletService.getWalletAccount(params.accountId);
    if (!account || account.chain !== "sui") {
      throw new Error("Only Sui accounts are supported for transfers.");
    }
    return this.getTransferService().prepareTransfer({
      accountId: params.accountId,
      senderAddress: account.address,
      recipient: params.recipient,
      coinType: params.coinType,
      amountDisplay: params.amountDisplay,
    });
  }

  async confirmTransfer(params: { transferRequestId: string }): Promise<TransferExecuteResult> {
    return this.getTransferService().confirmTransfer(params);
  }

  async executeComposite(params: {
    accountId: string;
    proposalSnapshot: CompositeProposalSnapshotV1;
  }): Promise<SwapExecuteResult> {
    return executeCompositeProposal(params);
  }

  async executeRebalance(params: {
    accountId: string;
    proposalSnapshot: RebalanceProposalSnapshotV1;
  }): Promise<SwapExecuteResult> {
    return executeRebalanceProposal(params);
  }

  async executeAssistantSwap(params: {
    accountId: string;
    proposalSnapshot: SwapProposalSnapshotV1;
  }): Promise<SwapExecuteResult> {
    const account = walletService.getWalletAccount(params.accountId);
    if (!account || account.chain !== "sui") {
      throw new Error("Only Sui accounts support swaps.");
    }
    const result = await suiAftermathSwapService.executePreparedSwap(params.proposalSnapshot);
    return { digest: result.digest, explorerUrl: result.explorerUrl };
  }

  async buildAssistantWalletContext(
    accountId: string,
    options?: { balances?: TokenBalanceView[] },
  ): Promise<string> {
    try {
      const account = walletService.getWalletAccount(accountId);
      if (!account) {
        return `No wallet account found for id ${accountId}.`;
      }
      const net = networkSettingsService.getSnapshot();
      const lines = [
        `Active account: ${account.name} (${account.id})`,
        `Chain: ${account.chain}`,
        `Network: ${net.activeEnvironment} (${net.chainIdLabel})`,
        `RPC: ${net.rpcUrl}`,
        `Address: ${account.address}`,
      ];
      if (account.chain === "sui") {
        const balances = options?.balances ?? (await this.getTokenBalances(accountId));
        if (balances.length) {
          lines.push("Token balances (formatted):");
          for (const b of balances.slice(0, 20)) {
            const usd = b.usdValue ? `, ~${b.usdValue}` : "";
            lines.push(
              `- ${b.symbol}: ${b.balanceFormatted}${usd} (raw: ${b.balanceRaw}, type: ${b.coinType})`,
            );
          }
          if (balances.length > 20) {
            lines.push(`…and ${balances.length - 20} more tokens`);
          }
        } else {
          lines.push("Token balances: none (empty or not yet fetched).");
        }
      }
      return lines.join("\n");
    } catch (e) {
      console.warn("[chain] assistant context failed", e instanceof Error ? e.message : e);
      return "";
    }
  }
}

export const chainFacadeService = new ChainFacadeService();
