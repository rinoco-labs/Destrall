import { networkSettingsService } from "../../../main/services/network/networkSettingsService";
import { getSuiClientForEnvironment } from "../../../main/services/chains/sui/sui-client.service";
import { getTransactionExplorerUrl } from "../../../main/services/chains/sui/sui-explorer.service";
import { signSuiTransactionDataEd25519 } from "../../../main/services/chains/sui/sui-ed25519-tx-signer";
import { deriveSuiAccountFromMnemonic } from "../../../main/services/chains/sui/sui-wallet.service";
import { walletService } from "../../../main/wallet/walletService";
import { walletSession } from "../../../main/wallet/walletSession";
import type { RebalanceProposalSnapshotV1 } from "./rebalance.types";
import { buildRebalancePtbBytes } from "./rebalancePtbBuilder";

export async function executeRebalanceProposal(params: {
  accountId: string;
  proposalSnapshot: RebalanceProposalSnapshotV1;
}): Promise<{ digest: string; explorerUrl: string | null }> {
  const snap = params.proposalSnapshot;
  if (snap.v !== 1) throw new Error("Unsupported rebalance proposal version.");
  if (Date.now() > snap.expiresAtMs) {
    throw new Error("Rebalance proposal expired. Prepare again.");
  }

  const env = networkSettingsService.getSuiEnvironment();
  if (env !== snap.suiEnvironment) {
    throw new Error("Network changed since this proposal was prepared.");
  }

  const account = walletService.getWalletAccount(params.accountId);
  if (!account || account.address !== snap.walletAddress) {
    throw new Error("Account does not match this rebalance proposal.");
  }

  const mnemonic = walletSession.getMnemonic();
  if (!mnemonic) throw new Error("Wallet is locked.");

  const keyMaterial = deriveSuiAccountFromMnemonic(mnemonic, account.accountIndex);
  const bytes = await buildRebalancePtbBytes(snap.swapLegs, snap.walletAddress, env);
  const signature = signSuiTransactionDataEd25519(keyMaterial.privateKey, bytes);
  const client = getSuiClientForEnvironment(env);

  const result = await client.executeTransactionBlock({
    transactionBlock: bytes,
    signature,
    options: { showEffects: true },
  });
  console.info("[rebalance] executed", result.digest);
  return {
    digest: result.digest,
    explorerUrl: getTransactionExplorerUrl(env, result.digest),
  };
}
