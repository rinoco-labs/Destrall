import { randomUUID } from "node:crypto";
import type { AssistantStructuredResult } from "../../../../assistant/assistantResultTypes";
import type { ActionContext } from "../../../runtime/actionContext";
import { decimalStringToRawAmount } from "../../../../main/services/chains/amount-utils";
import { formatTokenAmount } from "../../../../main/services/chains/sui/sui-balance.service";
import { getSuiClientForEnvironment } from "../../../../main/services/chains/sui/sui-client.service";
import {
  isNormalizedSuiNativeCoin,
  normalizeSuiCoinType,
} from "../../../../main/services/chains/sui/sui-coin-type-normalize";
import {
  getYieldPositionsInputSchema,
  listYieldPoolsInputSchema,
  prepareYieldDepositInputSchema,
  prepareYieldWithdrawInputSchema,
} from "./navi.schemas";
import { fetchNaviPools } from "./navi-pools.service";
import { resolveNaviPoolByAsset } from "../../../../services/tokens/naviTokenResolver";
import { findWalletBalanceByCoinType } from "../../../../services/tokens/walletTokenResolver";
import { validateSpendAmount } from "../../../../services/tokens/balanceValidation";
import { buildNaviPositionViews, fetchNaviPositionsOnChain } from "./navi-positions.service";
import {
  readStoredYieldRiskProfile,
  recommendationPreamble,
  sortPoolsForRiskProfile,
  type YieldRiskProfile,
} from "./navi-risk.service";
import { buildNaviDepositProposalCard, buildNaviWithdrawProposalCard } from "./navi-proposal-builder";
import type { NaviYieldProposalSnapshotV1 } from "./navi.types";

const PROPOSAL_TTL_MS = 3 * 60 * 1000;

function assertSuiMainnetForNavi(env: string, displayName: string): AssistantStructuredResult[] | null {
  if (env !== "mainnet") {
    return [
      {
        type: "error",
        message: `Navi yield is only wired for Sui mainnet right now (current: ${displayName}). Switch to mainnet to view pools or prepare transactions.`,
        code: "unsupported_network",
      },
    ];
  }
  return null;
}

async function estimateGasBudgetFormatted(env: Parameters<typeof getSuiClientForEnvironment>[0]): Promise<string> {
  const client = getSuiClientForEnvironment(env);
  const gasPrice = await client.getReferenceGasPrice();
  const budget = BigInt(gasPrice) * 400_000n;
  const b = budget > 80_000_000n ? budget : 80_000_000n;
  return formatTokenAmount(b, 9);
}

function humanPositionToAmountDisplay(n: number, decimals: number): string {
  const d = Math.min(Math.max(decimals, 0), 12);
  const s = n.toFixed(d);
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") || "0";
}

function parsePercentString(s: string): number {
  const t = s.trim().replace(/%/g, "");
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n <= 0 || n > 100) throw new Error("Percentage must be between 0 and 100.");
  return n;
}

export async function listYieldPoolsAction(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  const parsed = listYieldPoolsInputSchema.safeParse(input);
  if (!parsed.success) {
    return [{ type: "error", message: "Invalid request.", code: "invalid_input" }];
  }
  const account = ctx.wallet.getActiveAccount();
  if (!account || account.chain !== "sui") {
    return [{ type: "error", message: "Switch to a Sui account to view Navi pools.", code: "unsupported_chain" }];
  }
  const net = ctx.network.getActiveNetwork();
  const gate = assertSuiMainnetForNavi(net.environment, net.displayName);
  if (gate) return gate;

  const riskProfile: YieldRiskProfile = parsed.data.riskProfile ?? readStoredYieldRiskProfile();
  let pools = await fetchNaviPools(net.environment, false);
  const assetFilter = parsed.data.asset?.trim().toUpperCase();
  if (assetFilter) {
    pools = pools.filter((p) => p.symbol.toUpperCase().includes(assetFilter));
  }
  pools = sortPoolsForRiskProfile(pools, riskProfile, parsed.data.sortBy);
  const limit = parsed.data.limit;
  if (typeof limit === "number" && limit > 0) {
    pools = pools.slice(0, limit);
  }

  const preamble = recommendationPreamble(riskProfile);

  return [
    {
      type: "available_yield_pools",
      network: net.displayName,
      protocolLabel: "NAVI PROTOCOL",
      recommendationNote: parsed.data.sortBy || parsed.data.riskProfile ? preamble : undefined,
      pools: pools.map((p) => {
        const supply = BigInt(p.totalSupplyRaw || "0");
        const borrow = BigInt(p.totalBorrowRaw || "0");
        let utilization: string | undefined;
        if (supply > 0n) {
          const u = Number((borrow * 10000n) / supply) / 100;
          utilization = `${u.toFixed(2)}%`;
        }
        let tvlUsd: string | undefined;
        if (p.priceUsd && p.priceUsd > 0) {
          const raw = supply;
          const approx = (Number(raw) / 10 ** p.decimals) * p.priceUsd;
          if (Number.isFinite(approx) && approx > 0) {
            tvlUsd = `~$${approx.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
          }
        }
        return {
          protocol: "Navi",
          asset: p.symbol,
          apy: `${p.supplyApy.toFixed(2)}%`,
          tvlUsd,
          utilization,
          riskLabel: p.risk,
          coinType: p.coinType,
        };
      }),
      emptyHint: pools.length ? undefined : "No active Navi pools returned for this network.",
    },
  ];
}

export async function getYieldPositionsAction(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  const parsed = getYieldPositionsInputSchema.safeParse(input);
  if (!parsed.success) {
    return [{ type: "error", message: "Invalid request.", code: "invalid_input" }];
  }
  const account = ctx.wallet.getActiveAccount();
  if (!account || account.chain !== "sui") {
    return [{ type: "error", message: "Switch to a Sui account to view yield positions.", code: "unsupported_chain" }];
  }
  const net = ctx.network.getActiveNetwork();
  const gate = assertSuiMainnetForNavi(net.environment, net.displayName);
  if (gate) return gate;

  const pools = await fetchNaviPools(net.environment, false);
  const views = await buildNaviPositionViews(account.address, net.environment, pools);
  const assetFilter = parsed.data.asset?.trim().toUpperCase();
  const filtered = assetFilter
    ? views.filter((v) => v.assetSymbol.toUpperCase().includes(assetFilter))
    : views;

  return [
    {
      type: "yield_positions",
      network: net.displayName,
      positions: filtered.map((v) => ({
        protocol: v.protocol,
        asset: v.assetSymbol,
        supplied: `${v.suppliedFormatted} ${v.assetSymbol}`,
        currentValue: v.currentValueFormatted ? `${v.currentValueFormatted} ${v.assetSymbol}` : undefined,
        apy: `${v.apy.toFixed(2)}%`,
        coinType: v.coinType,
        poolObjectId: v.poolObjectId,
        riskLabel: v.risk,
      })),
      emptyHint:
        filtered.length === 0
          ? "No open Navi supply positions detected for this address on mainnet."
          : undefined,
    },
  ];
}

export async function prepareYieldDepositAction(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  const parsed = prepareYieldDepositInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid deposit request.";
    return [{ type: "error", message: first, code: "invalid_input" }];
  }
  const account = ctx.wallet.getActiveAccount();
  if (!account || account.chain !== "sui") {
    return [{ type: "error", message: "Only Sui accounts can use Navi yield.", code: "unsupported_chain" }];
  }
  const net = ctx.network.getActiveNetwork();
  const gate = assertSuiMainnetForNavi(net.environment, net.displayName);
  if (gate) return gate;

  const pools = await fetchNaviPools(net.environment, false);
  const poolResult = resolveNaviPoolByAsset(pools, parsed.data.asset);
  if (poolResult.kind === "not_found") {
    return [{ type: "error", message: poolResult.message, code: "unknown_asset" }];
  }
  if (poolResult.kind === "ambiguous") {
    return [
      {
        type: "error",
        message: `Multiple Navi pools match "${parsed.data.asset.trim()}": ${poolResult.candidates.map((c) => c.symbol).join(", ")}. Be more specific.`,
        code: "ambiguous_asset",
      },
    ];
  }
  const pool = poolResult.pool;

  const balances = await ctx.wallet.getBalances();
  const bal =
    findWalletBalanceByCoinType(balances, pool.coinType) ??
    balances.find((b) => normalizeSuiCoinType(b.coinType) === normalizeSuiCoinType(pool.coinType));
  if (!bal) {
    return [
      {
        type: "error",
        message: `No ${pool.symbol} (wallet coin) in this connected wallet. Deposit requires the underlying token in your wallet first.`,
        code: "insufficient_funds",
      },
    ];
  }

  const amountKind = parsed.data.amountKind ?? "absolute";
  let amountDisplay = parsed.data.amount.trim();
  let amountRaw: bigint;
  if (amountKind === "percentage") {
    const pct = parsePercentString(amountDisplay);
    const walletRaw = BigInt(bal.balanceRaw);
    const basisPoints = Math.round(pct * 10000);
    amountRaw = (walletRaw * BigInt(basisPoints)) / 10000n;
    if (amountRaw <= 0n) {
      return [{ type: "error", message: "Computed amount is zero.", code: "invalid_amount" }];
    }
    amountDisplay = formatTokenAmount(amountRaw, bal.decimals);
  } else {
    amountRaw = decimalStringToRawAmount(parsed.data.amount.trim(), bal.decimals);
  }

  if (!isNormalizedSuiNativeCoin(pool.coinType)) {
    const spendCheck = validateSpendAmount({
      amountDisplay: amountDisplay,
      balance: bal,
      actionLabel: "This deposit",
    });
    if (!spendCheck.ok) {
      return [{ type: "error", message: spendCheck.message, code: spendCheck.code }];
    }
  }

  if (isNormalizedSuiNativeCoin(pool.coinType)) {
    const client = getSuiClientForEnvironment(net.environment);
    const suiBal = await client.getBalance({ owner: account.address });
    const gasHeadroom = 80_000_000n;
    if (BigInt(suiBal.totalBalance) < amountRaw + gasHeadroom) {
      return [{ type: "error", message: "Not enough SUI for this deposit plus gas.", code: "insufficient_funds" }];
    }
  }

  const gasBudgetFormatted = await estimateGasBudgetFormatted(net.environment);

  const now = Date.now();
  const snapshot: NaviYieldProposalSnapshotV1 = {
    v: 1,
    kind: "deposit",
    accountId: ctx.accountId,
    suiEnvironment: net.environment,
    walletAddress: account.address,
    assetSymbol: pool.symbol,
    coinType: pool.coinType,
    decimals: pool.decimals,
    assetId: pool.assetId,
    poolObjectId: pool.poolObjectId,
    reserveId: pool.reserveId,
    amountRaw: amountRaw.toString(),
    amountDisplay,
    feeAmountRaw: "0",
    supplyApyAtPrepare: pool.supplyApy,
    preparedAtMs: now,
    expiresAtMs: now + PROPOSAL_TTL_MS,
  };

  const card = buildNaviDepositProposalCard({
    assetSymbol: pool.symbol,
    amountDisplay,
    networkLabel: net.displayName,
    apyPct: pool.supplyApy,
    gasBudgetFormatted,
    riskLabel: pool.risk,
  });

  return [
    {
      type: "navi_deposit_proposal",
      proposalId: randomUUID(),
      status: "pending",
      proposalSnapshot: snapshot,
      card,
    },
  ];
}

export async function prepareYieldWithdrawAction(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  const parsed = prepareYieldWithdrawInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid withdraw request.";
    return [{ type: "error", message: first, code: "invalid_input" }];
  }
  const account = ctx.wallet.getActiveAccount();
  if (!account || account.chain !== "sui") {
    return [{ type: "error", message: "Only Sui accounts can use Navi yield.", code: "unsupported_chain" }];
  }
  const net = ctx.network.getActiveNetwork();
  const gate = assertSuiMainnetForNavi(net.environment, net.displayName);
  if (gate) return gate;

  const amountKind = parsed.data.amountKind ?? "absolute";
  if (amountKind === "interest") {
    return [
      {
        type: "error",
        message:
          "Withdrawing only interest is not supported without local deposit history. Specify an amount or withdraw all.",
        code: "unsupported_withdraw_mode",
      },
    ];
  }

  const pools = await fetchNaviPools(net.environment, false);
  const poolResult = resolveNaviPoolByAsset(pools, parsed.data.asset);
  if (poolResult.kind === "not_found") {
    return [{ type: "error", message: poolResult.message, code: "unknown_asset" }];
  }
  if (poolResult.kind === "ambiguous") {
    return [
      {
        type: "error",
        message: `Multiple Navi pools match "${parsed.data.asset.trim()}": ${poolResult.candidates.map((c) => c.symbol).join(", ")}.`,
        code: "ambiguous_asset",
      },
    ];
  }
  const pool = poolResult.pool;

  const onChain = await fetchNaviPositionsOnChain(account.address, net.environment);
  const pos = onChain.find((p) => p.assetId === pool.assetId);
  if (!pos) {
    return [
      {
        type: "error",
        message: `You do not have a Navi position in ${pool.symbol} on this account.`,
        code: "no_position",
      },
    ];
  }

  let amountDisplay: string;
  let amountRaw: bigint;

  if (amountKind === "all") {
    amountDisplay = humanPositionToAmountDisplay(pos.supplyBalanceHuman, pos.decimals);
    amountRaw = decimalStringToRawAmount(amountDisplay, pos.decimals);
  } else if (amountKind === "percentage") {
    const pctStr = (parsed.data.amount ?? "").trim();
    if (!pctStr) {
      return [{ type: "error", message: "Specify a percentage to withdraw.", code: "invalid_input" }];
    }
    const pct = parsePercentString(pctStr);
    const human = (pos.supplyBalanceHuman * pct) / 100;
    amountDisplay = humanPositionToAmountDisplay(human, pos.decimals);
    amountRaw = decimalStringToRawAmount(amountDisplay, pos.decimals);
  } else {
    const amt = (parsed.data.amount ?? "").trim();
    if (!amt) {
      return [{ type: "error", message: "Specify an amount to withdraw.", code: "invalid_input" }];
    }
    amountDisplay = amt;
    amountRaw = decimalStringToRawAmount(amt, pos.decimals);
  }

  const maxRaw = decimalStringToRawAmount(
    humanPositionToAmountDisplay(pos.supplyBalanceHuman, pos.decimals),
    pos.decimals,
  );
  if (amountRaw > maxRaw) {
    return [{ type: "error", message: "That amount is larger than your Navi position.", code: "invalid_amount" }];
  }

  const gasBudgetFormatted = await estimateGasBudgetFormatted(net.environment);
  const now = Date.now();
  const snapshot: NaviYieldProposalSnapshotV1 = {
    v: 1,
    kind: "withdraw",
    accountId: ctx.accountId,
    suiEnvironment: net.environment,
    walletAddress: account.address,
    assetSymbol: pool.symbol,
    coinType: pool.coinType,
    decimals: pool.decimals,
    assetId: pool.assetId,
    poolObjectId: pool.poolObjectId,
    reserveId: pool.reserveId,
    amountRaw: amountRaw.toString(),
    amountDisplay,
    feeAmountRaw: "0",
    supplyApyAtPrepare: pool.supplyApy,
    preparedAtMs: now,
    expiresAtMs: now + PROPOSAL_TTL_MS,
  };

  const card = buildNaviWithdrawProposalCard({
    assetSymbol: pool.symbol,
    amountDisplay,
    networkLabel: net.displayName,
    apyPct: pool.supplyApy,
    gasBudgetFormatted,
    positionSummary: `${humanPositionToAmountDisplay(pos.supplyBalanceHuman, pos.decimals)} ${pool.symbol} supplied`,
  });

  return [
    {
      type: "navi_withdraw_proposal",
      proposalId: randomUUID(),
      status: "pending",
      proposalSnapshot: snapshot,
      card,
    },
  ];
}

export async function executeYieldActionAction(
  _input: Record<string, unknown>,
  _ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  void _input;
  void _ctx;
  return [
    {
      type: "error",
      message: "Yield transactions run only after you tap Approve on the Navi card.",
      code: "yield_execute_via_ui",
    },
  ];
}
