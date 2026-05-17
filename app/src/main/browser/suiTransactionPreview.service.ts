import { resolveTransactionBytesFromDappJson } from "../../services/transactions/decodeTransaction.service";
import { getSuiClientForEnvironment } from "../services/chains/sui/sui-client.service";
import { networkSettingsService } from "../services/network/networkSettingsService";
import { walletService } from "../wallet/walletService";

function ownerAddress(owner: unknown): string | undefined {
  if (!owner || typeof owner !== "object") return undefined;
  const o = owner as Record<string, unknown>;
  if (typeof o.AddressOwner === "string") return o.AddressOwner;
  if (o.AddressOwner && typeof o.AddressOwner === "object") {
    const inner = o.AddressOwner as Record<string, unknown>;
    if (typeof inner.address === "string") return inner.address;
  }
  return undefined;
}

export const suiTransactionPreviewService = {
  async preview(params: { accountId: string; txDataJson: string }) {
    const account = walletService.getWalletAccount(params.accountId);
    if (!account || account.chain !== "sui") {
      throw new Error("Active Sui account not found.");
    }

    const client = getSuiClientForEnvironment(networkSettingsService.getSuiEnvironment());
    const txBytes = await resolveTransactionBytesFromDappJson(params.txDataJson, {
      client,
      sender: account.address,
    });

    try {
      const result = await client.dryRunTransactionBlock({
        transactionBlock: txBytes,
      });

      const gas = result.effects?.gasUsed;
      const computation = gas?.computationCost ? BigInt(gas.computationCost) : 0n;
      const storage = gas?.storageCost ? BigInt(gas.storageCost) : 0n;
      const rebate = gas?.storageRebate ? BigInt(gas.storageRebate) : 0n;
      const nonRefundable = gas?.nonRefundableStorageFee ? BigInt(gas.nonRefundableStorageFee) : 0n;
      const total = computation + storage - rebate + nonRefundable;
      const gasEstimate =
        total > 0n ? `${(Number(total) / 1_000_000_000).toFixed(6).replace(/\.?0+$/, "")} SUI` : undefined;

      const balanceChanges = (result.balanceChanges ?? []).map((change) => ({
        coinType: change.coinType,
        amount: change.amount,
        owner: ownerAddress(change.owner),
      }));

      return {
        ok: true,
        gasEstimate,
        balanceChanges,
      };
    } catch (error) {
      return {
        ok: false,
        errorMessage: error instanceof Error ? error.message : "Simulation failed",
        balanceChanges: [] as { coinType: string; amount: string; owner?: string }[],
      };
    }
  },
};
