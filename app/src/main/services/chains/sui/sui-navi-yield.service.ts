import type { NaviPoolRow, NaviYieldProposalSnapshotV1 } from "../../../../packages/core/yield/navi/navi.types";
import { fetchNaviPools, resolvePoolByAssetSymbol } from "../../../../packages/core/yield/navi/navi-pools.service";
import { buildNaviDepositTransactionBytes, buildNaviWithdrawTransactionBytes } from "../../../../packages/core/yield/navi/navi-transaction-builder";
import { fetchNaviPositionsOnChain } from "../../../../packages/core/yield/navi/navi-positions.service";
import { decimalStringToRawAmount } from "../amount-utils";
import { getSuiClientForEnvironment } from "./sui-client.service";
import { networkSettingsService } from "../../network/networkSettingsService";
import { walletService } from "../../../wallet/walletService";
import { walletSession } from "../../../wallet/walletSession";
import { deriveSuiAccountFromMnemonic } from "./sui-wallet.service";
import { signSuiTransactionDataEd25519 } from "./sui-ed25519-tx-signer";
import { getTransactionExplorerUrl } from "./sui-explorer.service";
import { isNormalizedSuiNativeCoin } from "./sui-coin-type-normalize";

function humanPositionToAmountDisplay(n: number, decimals: number): string {
  const d = Math.min(Math.max(decimals, 0), 12);
  const s = n.toFixed(d);
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") || "0";
}

export class SuiNaviYieldService {
  async executeApprovedProposal(params: {
    accountId: string;
    proposalSnapshot: NaviYieldProposalSnapshotV1;
  }): Promise<{ digest: string; explorerUrl: string | null }> {
    const snap = params.proposalSnapshot;
    if (snap.v !== 1) {
      throw new Error("Unsupported yield proposal version.");
    }

    const env = networkSettingsService.getSuiEnvironment();
    if (env !== snap.suiEnvironment) {
      throw new Error("The selected network no longer matches this proposal. Prepare it again.");
    }
    if (env !== "mainnet") {
      throw new Error("Navi yield execution is limited to mainnet in this build.");
    }
    if (Date.now() > snap.expiresAtMs) {
      throw new Error("Proposal expired. Please prepare a new transaction.");
    }

    const account = walletService.getWalletAccount(params.accountId);
    if (!account || account.address !== snap.walletAddress) {
      throw new Error("This proposal was prepared for another account.");
    }

    const mnemonic = walletSession.getMnemonic();
    if (!mnemonic) {
      throw new Error("Wallet is locked. Unlock to complete this action.");
    }

    const keyMaterial = deriveSuiAccountFromMnemonic(mnemonic, account.accountIndex);
    if (keyMaterial.address !== snap.walletAddress) {
      throw new Error("Active signing key does not match this proposal.");
    }

    const pools = await fetchNaviPools(env, true);
    const pool = await resolvePoolByAssetSymbol(pools, snap.assetSymbol);
    if (!pool || pool.poolObjectId !== snap.poolObjectId || pool.assetId !== snap.assetId) {
      throw new Error("Pool metadata changed. Prepare a new proposal.");
    }

    const poolRow: NaviPoolRow = pool;
    const amountRaw = BigInt(snap.amountRaw);

    if (snap.kind === "withdraw") {
      const positions = await fetchNaviPositionsOnChain(snap.walletAddress, env);
      const pos = positions.find((p) => p.assetId === snap.assetId);
      if (!pos) {
        throw new Error("No Navi position found for this asset anymore.");
      }
      const maxDisplay = humanPositionToAmountDisplay(pos.supplyBalanceHuman, snap.decimals);
      const maxRaw = decimalStringToRawAmount(maxDisplay, snap.decimals);
      if (amountRaw > maxRaw) {
        throw new Error("Withdraw amount exceeds your current position.");
      }
    } else if (snap.kind === "deposit") {
      const client = getSuiClientForEnvironment(env);
      if (isNormalizedSuiNativeCoin(poolRow.coinType)) {
        const suiBal = await client.getBalance({ owner: snap.walletAddress });
        const gasHeadroom = 80_000_000n;
        if (BigInt(suiBal.totalBalance) < amountRaw + gasHeadroom) {
          throw new Error("Insufficient SUI for this deposit plus gas.");
        }
      }
    }

    let bytes: Uint8Array;
    if (snap.kind === "deposit") {
      bytes = await buildNaviDepositTransactionBytes({
        pool: poolRow,
        amountRaw,
        senderAddress: snap.walletAddress,
        env,
      });
    } else {
      bytes = await buildNaviWithdrawTransactionBytes({
        pool: poolRow,
        amountRaw,
        senderAddress: snap.walletAddress,
        env,
        feeAmountRaw: BigInt(snap.feeAmountRaw),
        treasuryAddress: snap.treasuryAddress ?? null,
      });
    }

    const signature = signSuiTransactionDataEd25519(keyMaterial.privateKey, bytes);
    const client = getSuiClientForEnvironment(env);

    try {
      const result = await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: { showEffects: true },
      });
      const digest = result.digest;
      return {
        digest,
        explorerUrl: getTransactionExplorerUrl(env, digest),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[navi-yield] execute failed (sanitized)", msg);
      if (/MoveAbort.*1502|abort code:\s*1502/i.test(msg)) {
        throw new Error(
          "Navi rejected the transaction because prices were stale. Try again; the app refreshes oracle prices in the same transaction.",
        );
      }
      if (/InsufficientCoin|insufficient/i.test(msg)) {
        throw new Error("Insufficient balance.");
      }
      if (/timeout|ETIMEDOUT|fetch failed/i.test(msg)) {
        throw new Error("Network unavailable or RPC timeout.");
      }
      throw new Error("Navi transaction failed.");
    }
  }
}

export const suiNaviYieldService = new SuiNaviYieldService();
