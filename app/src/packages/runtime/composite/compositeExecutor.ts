import { networkSettingsService } from "../../../main/services/network/networkSettingsService";
import { getSuiClientForEnvironment } from "../../../main/services/chains/sui/sui-client.service";
import { getTransactionExplorerUrl } from "../../../main/services/chains/sui/sui-explorer.service";
import { signSuiTransactionDataEd25519 } from "../../../main/services/chains/sui/sui-ed25519-tx-signer";
import { deriveSuiAccountFromMnemonic } from "../../../main/services/chains/sui/sui-wallet.service";
import { walletService } from "../../../main/wallet/walletService";
import { walletSession } from "../../../main/wallet/walletSession";
import type { CompositeProposalSnapshotV1 } from "./compositeTypes";
import { validateCompositeProposalBeforeExecution } from "./compositeValidation";
import { buildCompositePtbBytes } from "./compositePtbBuilder";
import { suiAftermathSwapService } from "../../../main/services/chains/sui/sui-aftermath-swap.service";
import { suiNaviYieldService } from "../../../main/services/chains/sui/sui-navi-yield.service";

export type CompositeExecutionStage = "swap" | "deposit";

export function describeCompositeExecutionOrder(): CompositeExecutionStage[] {
  return ["swap", "deposit"];
}

export async function executeCompositeProposal(params: {
  accountId: string;
  proposalSnapshot: CompositeProposalSnapshotV1;
}): Promise<{ digest: string; explorerUrl: string | null }> {
  const snap = params.proposalSnapshot;
  console.info("[composite] execute", {
    compositeId: snap.compositeId,
    model: snap.executionModel,
  });

  const validation = await validateCompositeProposalBeforeExecution(snap);
  if (validation.ok === false) {
    throw new Error(validation.reason);
  }

  if (snap.executionModel === "ptb") {
    return executeCompositePtb(params.accountId, snap);
  }

  return executeStagedComposite(params.accountId, snap);
}

async function executeCompositePtb(
  accountId: string,
  snap: CompositeProposalSnapshotV1,
): Promise<{ digest: string; explorerUrl: string | null }> {
  const account = walletService.getWalletAccount(accountId);
  if (!account) throw new Error("Account not found.");

  const mnemonic = walletSession.getMnemonic();
  if (!mnemonic) throw new Error("Wallet is locked. Unlock to complete this action.");

  const keyMaterial = deriveSuiAccountFromMnemonic(mnemonic, account.accountIndex);
  const bytes = await buildCompositePtbBytes(snap);
  const signature = signSuiTransactionDataEd25519(keyMaterial.privateKey, bytes);
  const env = networkSettingsService.getSuiEnvironment();
  const client = getSuiClientForEnvironment(env);

  try {
    const result = await client.executeTransactionBlock({
      transactionBlock: bytes,
      signature,
      options: { showEffects: true },
    });
    const digest = result.digest;
    console.info("[composite] PTB success", digest);
    return {
      digest,
      explorerUrl: getTransactionExplorerUrl(env, digest),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[composite] PTB execute failed", msg);
    throw new Error("Composite transaction failed. Prepare a new proposal and try again.");
  }
}

/** Fallback: swap only — deposit must be prepared separately after confirmation. */
async function executeStagedComposite(
  accountId: string,
  snap: CompositeProposalSnapshotV1,
): Promise<{ digest: string; explorerUrl: string | null }> {
  if (!snap.swapSnapshot) {
    throw new Error("Staged composite is missing swap data.");
  }
  const swapResult = await suiAftermathSwapService.executePreparedSwap(snap.swapSnapshot);
  if (snap.depositSnapshot) {
    console.info("[composite] staged: swap done; deposit still requires separate approval");
    void suiNaviYieldService;
  }
  return { digest: swapResult.digest, explorerUrl: swapResult.explorerUrl };
}
