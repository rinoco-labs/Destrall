import { Transaction } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { SuiChainEnvironment } from "../../../../config/chains/sui";
import { decimalStringToRawAmount } from "../amount-utils";
import { formatTokenAmount } from "./sui-balance.service";
import { getSuiClientForEnvironment } from "./sui-client.service";
import { SuiTokenMetadataService } from "./sui-token-metadata.service";
import { getTransactionExplorerUrl } from "./sui-explorer.service";
import { deriveSuiAccountFromMnemonic } from "./sui-wallet.service";
import { signSuiTransactionDataEd25519 } from "./sui-ed25519-tx-signer";
import { walletSession } from "../../../wallet/walletSession";
import { walletService } from "../../../wallet/walletService";
import { networkSettingsService } from "../../network/networkSettingsService";
import type { SwapProposalSnapshotV1 } from "@packages/core/swap/swap.types";
import {
  type AftermathTradeRoute,
  aftermathRouterRequest,
} from "./aftermath-router-api";
import { isNormalizedSuiNativeCoin, normalizeSuiCoinType } from "./sui-coin-type-normalize";

const BIGINT_MARK = "__bigint:";

const ROUTE_TTL_MS = 2 * 60 * 1000;

const SUPPORTED_COINS_TTL_MS = 5 * 60 * 1000;

function amountFromRouteField(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.trunc(v));
  if (typeof v === "string") {
    const s = v.endsWith("n") ? v.slice(0, -1) : v;
    if (/^\d+$/.test(s)) return BigInt(s);
  }
  throw new Error("Invalid amount in route response.");
}

export function serializeAftermathRoute(route: AftermathTradeRoute): string {
  return JSON.stringify(route, (_k, v) => (typeof v === "bigint" ? `${BIGINT_MARK}${v.toString()}` : v));
}

export function deserializeAftermathRoute(json: string): AftermathTradeRoute {
  return JSON.parse(json, (_k, v) => {
    if (typeof v === "string" && v.startsWith(BIGINT_MARK)) {
      return BigInt(v.slice(BIGINT_MARK.length));
    }
    return v;
  }) as AftermathTradeRoute;
}

async function fetchAllCoinObjects(client: SuiJsonRpcClient, owner: string, coinType: string) {
  const out: { coinObjectId: string; balance: string }[] = [];
  let cursor: string | null | undefined;
  do {
    const page = await client.getCoins({ owner, coinType, cursor: cursor ?? undefined });
    out.push(...page.data.map((c) => ({ coinObjectId: c.coinObjectId, balance: c.balance })));
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);
  return out;
}

async function ensureSpendableBalance(params: {
  client: SuiJsonRpcClient;
  address: string;
  coinType: string;
  amount: bigint;
}) {
  const gasHeadroom = 80_000_000n;
  const suiBal = await params.client.getBalance({ owner: params.address });
  const suiTotal = BigInt(suiBal.totalBalance);
  if (isNormalizedSuiNativeCoin(params.coinType)) {
    if (suiTotal < params.amount + gasHeadroom) {
      throw new Error("Insufficient balance.");
    }
    return;
  }
  if (suiTotal < gasHeadroom) {
    throw new Error("Insufficient SUI for gas.");
  }
  const coins = await fetchAllCoinObjects(params.client, params.address, params.coinType);
  let total = 0n;
  for (const c of coins) {
    total += BigInt(c.balance);
  }
  if (total < params.amount) {
    throw new Error("Insufficient balance.");
  }
}

function summarizeRouteProtocols(route: AftermathTradeRoute): string {
  const names: string[] = [];
  for (const r of route.routes ?? []) {
    for (const p of r.paths ?? []) {
      if (p.protocolName && !names.includes(p.protocolName)) names.push(p.protocolName);
    }
  }
  return names.length ? names.slice(0, 10).join(" → ") : "Aftermath Router";
}

function formatSdkPercentage(p: number | undefined): string {
  if (p == null || Number.isNaN(p)) return "—";
  return `${(p * 100).toFixed(3)}%`;
}

function isJsonTransaction(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith("{")) return true;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      ("version" in parsed || "inputs" in parsed || "transactions" in parsed || "commands" in parsed)
    );
  } catch {
    return false;
  }
}

function extractTxPayload(txBuildResult: unknown): string | null {
  if (typeof txBuildResult === "string") {
    return txBuildResult;
  }
  if (txBuildResult && typeof txBuildResult === "object") {
    const obj = txBuildResult as Record<string, unknown>;
    if (typeof obj.tx === "string") return obj.tx;
    if (typeof obj.txBytes === "string") return obj.txBytes;
    if (typeof obj.txKind === "string") return obj.txKind;
  }
  return null;
}

/**
 * Turn Aftermath `transactions/trade` response into executable tx bytes (Expo-aligned).
 */
async function txBytesFromTradeBuildResult(
  txBuildResult: unknown,
  client: SuiJsonRpcClient,
): Promise<Uint8Array> {
  const raw =
    typeof txBuildResult === "string" ? txBuildResult : extractTxPayload(txBuildResult);
  if (!raw) {
    throw new Error("Could not build swap transaction for this network.");
  }
  if (isJsonTransaction(raw)) {
    const tx = Transaction.from(raw);
    return tx.build({ client });
  }
  return Uint8Array.from(Buffer.from(raw, "base64"));
}

export class SuiAftermathSwapService {
  private readonly supportedCoinsCache = new Map<
    SuiChainEnvironment,
    { fetchedAt: number; coinTypes: string[] }
  >();

  /**
   * Full supported-coin list via GET `/api/router/supported-coins`.
   * Optional filter is applied client-side — the SDK path `supported-coins/:filter` 404s on current API (Expo never uses it).
   */
  async getSupportedCoinTypes(env: SuiChainEnvironment, filter?: string): Promise<string[]> {
    if (env === "devnet") {
      throw new Error("Swaps are not supported on Devnet.");
    }

    const now = Date.now();
    let entry = this.supportedCoinsCache.get(env);
    if (!entry || now - entry.fetchedAt > SUPPORTED_COINS_TTL_MS) {
      const coinTypes = await aftermathRouterRequest<string[]>({
        env,
        path: "supported-coins",
      });
      const seen = new Set<string>();
      const normalized: string[] = [];
      for (const ct of coinTypes ?? []) {
        const n = normalizeSuiCoinType(ct);
        if (!seen.has(n)) {
          seen.add(n);
          normalized.push(n);
        }
      }
      entry = { fetchedAt: now, coinTypes: normalized };
      this.supportedCoinsCache.set(env, entry);
    }

    const all = entry.coinTypes;
    const q = filter?.trim().toLowerCase();
    if (!q) return all;

    return all.filter((ct) => {
      const low = ct.toLowerCase();
      const tail = (ct.split("::").pop() ?? "").toLowerCase();
      return low.includes(q) || tail.includes(q);
    });
  }

  async prepareSwapQuote(params: {
    env: SuiChainEnvironment;
    walletAddress: string;
    coinInType: string;
    coinOutType: string;
    amountDisplay: string;
    coinInDecimals: number;
    fromSymbol: string;
    toSymbol: string;
    slippageBps: number;
    externalFee?: { recipient: string; feePercentage: number };
  }): Promise<{
    route: AftermathTradeRoute;
    coinInAmountRaw: bigint;
    estimatedOutRaw: bigint;
    routeSummary: string;
    priceImpactLabel: string;
    gasBudgetMist: string;
    gasBudgetFormatted: string;
    quoteExpiresAtMs: number;
  }> {
    if (params.env === "devnet") {
      throw new Error("Swaps are not supported on Devnet.");
    }

    const coinInType = normalizeSuiCoinType(params.coinInType);
    const coinOutType = normalizeSuiCoinType(params.coinOutType);

    const client = getSuiClientForEnvironment(params.env);
    await ensureSpendableBalance({
      client,
      address: params.walletAddress,
      coinType: coinInType,
      amount: decimalStringToRawAmount(params.amountDisplay.trim(), params.coinInDecimals),
    });

    const coinInAmountRaw = decimalStringToRawAmount(params.amountDisplay.trim(), params.coinInDecimals);

    const routeBody: Record<string, unknown> = {
      coinInType,
      coinOutType,
      coinInAmount: coinInAmountRaw,
    };
    if (params.externalFee) {
      routeBody.externalFee = params.externalFee;
    }

    const route = await aftermathRouterRequest<AftermathTradeRoute>({
      env: params.env,
      path: "trade-route",
      body: routeBody,
    });

    const estimatedOutRaw = amountFromRouteField(route.coinOut?.amount);

    const slippage = params.slippageBps / 10_000;

    const txBuildResult = await aftermathRouterRequest<unknown>({
      env: params.env,
      path: "transactions/trade",
      body: {
        walletAddress: params.walletAddress,
        completeRoute: route,
        slippage,
      },
    });

    const gasPrice = await client.getReferenceGasPrice();
    const budget = BigInt(gasPrice) * 500_000n;
    const gasBudgetMist = (budget > 80_000_000n ? budget : 80_000_000n).toString();

    try {
      await txBytesFromTradeBuildResult(txBuildResult, client);
    } catch (e) {
      console.warn("[aftermath] swap tx dry build failed", e instanceof Error ? e.message : e);
      throw new Error("Could not build swap transaction for this network.");
    }

    const quoteExpiresAtMs = Date.now() + ROUTE_TTL_MS;
    return {
      route,
      coinInAmountRaw,
      estimatedOutRaw,
      routeSummary: summarizeRouteProtocols(route),
      priceImpactLabel: `Route fee (net) ${formatSdkPercentage(route.netTradeFeePercentage)}`,
      gasBudgetMist,
      gasBudgetFormatted: formatTokenAmount(BigInt(gasBudgetMist), 9),
      quoteExpiresAtMs,
    };
  }

  async executePreparedSwap(snapshot: SwapProposalSnapshotV1): Promise<{ digest: string; explorerUrl: string }> {
    if (snapshot.v !== 1) {
      throw new Error("Unsupported swap proposal version.");
    }
    const env = networkSettingsService.getSuiEnvironment();
    if (env !== snapshot.suiEnvironment) {
      throw new Error("The selected network no longer matches this proposal. Prepare the swap again.");
    }
    if (Date.now() > snapshot.quoteExpiresAtMs) {
      throw new Error("Quote expired. Please request a new quote.");
    }

    const supported = await this.getSupportedCoinTypes(env);
    const supportedSet = new Set(supported);
    const fromN = normalizeSuiCoinType(snapshot.fromCoinType);
    const toN = normalizeSuiCoinType(snapshot.toCoinType);
    if (!supportedSet.has(fromN) || !supportedSet.has(toN)) {
      throw new Error("These tokens are no longer supported by the swap router. Prepare a new quote.");
    }

    const account = walletService.getWalletAccount(snapshot.accountId);
    if (!account || account.address !== snapshot.walletAddress) {
      throw new Error("This swap was prepared for another account. Prepare it again from the correct account.");
    }

    const mnemonic = walletSession.getMnemonic();
    if (!mnemonic) {
      throw new Error("Wallet is locked. Unlock to complete this swap.");
    }

    const keyMaterial = deriveSuiAccountFromMnemonic(mnemonic, account.accountIndex);
    if (keyMaterial.address !== snapshot.walletAddress) {
      throw new Error("Active signing key does not match this proposal.");
    }

    const client = getSuiClientForEnvironment(env);
    const coinInAmount = BigInt(snapshot.coinInAmountRaw);
    await ensureSpendableBalance({
      client,
      address: snapshot.walletAddress,
      coinType: fromN,
      amount: coinInAmount,
    });

    const completeRoute = deserializeAftermathRoute(snapshot.completeRouteJson);
    const slippage = snapshot.slippageBps / 10_000;

    const txBuildResult = await aftermathRouterRequest<unknown>({
      env,
      path: "transactions/trade",
      body: {
        walletAddress: snapshot.walletAddress,
        completeRoute,
        slippage,
      },
    });

    let bytes: Uint8Array;
    try {
      bytes = await txBytesFromTradeBuildResult(txBuildResult, client);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[aftermath] swap build failed (sanitized)", msg);
      throw new Error("Could not build swap transaction for this network.");
    }

    const signature = signSuiTransactionDataEd25519(keyMaterial.privateKey, bytes);

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
      console.warn("[aftermath] swap execute failed (sanitized)", msg);
      if (/InsufficientCoin|insufficient/i.test(msg)) {
        throw new Error("Insufficient balance.");
      }
      if (/timeout|ETIMEDOUT|fetch failed/i.test(msg)) {
        throw new Error("Network unavailable or RPC timeout.");
      }
      throw new Error("Swap transaction failed.");
    }
  }
}

export const suiAftermathSwapService = new SuiAftermathSwapService();

export function getTokenMetadataServiceForActiveEnv(): SuiTokenMetadataService {
  return new SuiTokenMetadataService(() => getSuiClientForEnvironment(networkSettingsService.getSuiEnvironment()));
}
