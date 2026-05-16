import type { CompositeProposalSnapshotV1 } from "./compositeTypes";
import { deserializeExecutionPlan } from "./compositeExecutionPlan";
import { networkSettingsService } from "../../../main/services/network/networkSettingsService";
import { walletService } from "../../../main/wallet/walletService";
import { getSuiClientForEnvironment } from "../../../main/services/chains/sui/sui-client.service";
import { isNormalizedSuiNativeCoin } from "../../../main/services/chains/sui/sui-coin-type-normalize";
import { fetchNaviPools, resolvePoolByAssetSymbol } from "../../core/yield/navi/navi-pools.service";
import { deserializeAftermathRoute, suiAftermathSwapService } from "../../../main/services/chains/sui/sui-aftermath-swap.service";

export type CompositeValidationResult =
  | { ok: true }
  | { ok: false; reason: string; code: string };

/**
 * Re-validate balances, quotes, and pool metadata before signing a composite PTB.
 */
export async function validateCompositeProposalBeforeExecution(
  snapshot: CompositeProposalSnapshotV1,
): Promise<CompositeValidationResult> {
  if (snapshot.v !== 1) {
    return { ok: false, reason: "Unsupported composite proposal version.", code: "invalid_version" };
  }

  const env = networkSettingsService.getSuiEnvironment();
  if (env !== snapshot.suiEnvironment) {
    return {
      ok: false,
      reason: "Network changed since this proposal was prepared. Prepare it again.",
      code: "network_mismatch",
    };
  }

  if (Date.now() > snapshot.expiresAtMs) {
    return { ok: false, reason: "Composite proposal expired. Prepare a new one.", code: "expired" };
  }

  const account = walletService.getWalletAccount(snapshot.accountId);
  if (!account || account.address !== snapshot.walletAddress) {
    return { ok: false, reason: "Account no longer matches this proposal.", code: "account_mismatch" };
  }

  const plan = deserializeExecutionPlan(snapshot.planJson);

  if (snapshot.swapSnapshot) {
    const snap = snapshot.swapSnapshot;
    if (Date.now() > snap.quoteExpiresAtMs) {
      return { ok: false, reason: "Swap quote expired. Prepare a new composite action.", code: "stale_quote" };
    }
    try {
      const route = deserializeAftermathRoute(snap.completeRouteJson);
      const supported = await suiAftermathSwapService.getSupportedCoinTypes(env);
      const set = new Set(supported);
      if (!set.has(snap.fromCoinType) || !set.has(snap.toCoinType)) {
        return { ok: false, reason: "Swap route tokens are no longer supported.", code: "unsupported_token" };
      }
      const client = getSuiClientForEnvironment(env);
      const amount = BigInt(snap.coinInAmountRaw);
      if (!isNormalizedSuiNativeCoin(snap.fromCoinType)) {
        const bal = await client.getBalance({ owner: snap.walletAddress, coinType: snap.fromCoinType });
        if (BigInt(bal.totalBalance) < amount) {
          return { ok: false, reason: `Not enough ${snap.fromSymbol} for the swap.`, code: "insufficient_funds" };
        }
      }
      void route;
    } catch {
      return { ok: false, reason: "Could not validate swap route.", code: "invalid_route" };
    }
  }

  if (snapshot.depositSnapshot && plan.kind === "swap_then_deposit") {
    const dep = snapshot.depositSnapshot;
    const pools = await fetchNaviPools(env, true);
    const pool = await resolvePoolByAssetSymbol(pools, dep.assetSymbol);
    if (!pool || pool.poolObjectId !== dep.poolObjectId) {
      return { ok: false, reason: "Navi pool metadata changed. Prepare again.", code: "pool_changed" };
    }
    const amountRaw = BigInt(dep.amountRaw);
    if (snapshot.executionModel === "staged" && !isNormalizedSuiNativeCoin(dep.coinType)) {
      const client = getSuiClientForEnvironment(env);
      const bal = await client.getBalance({ owner: dep.walletAddress, coinType: dep.coinType });
      if (BigInt(bal.totalBalance) < amountRaw) {
        return { ok: false, reason: `Not enough ${dep.assetSymbol} on wallet for deposit.`, code: "insufficient_funds" };
      }
    }
  }

  return { ok: true };
}
