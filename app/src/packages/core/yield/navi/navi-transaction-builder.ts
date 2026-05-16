import { Transaction, type TransactionObjectArgument } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { SuiChainEnvironment } from "../../../../config/chains/sui";
import { getSuiClientForEnvironment } from "../../../../main/services/chains/sui/sui-client.service";
import { isNormalizedSuiNativeCoin } from "../../../../main/services/chains/sui/sui-coin-type-normalize";
import type { TransactionBuildContext } from "../../../../services/transactions/transactionContext";
import { fetchNaviConfig } from "./navi-config.service";
import type { NaviConfig, NaviOracleFeedRef, NaviPoolRow } from "./navi.types";

const CLOCK_ID = "0x06";
const SUI_SYSTEM_ID = "0x05";

function normalizeCoinTypeKey(ct: string): string {
  const s = String(ct).trim().toLowerCase();
  if (!s) return "";
  return s.startsWith("0x") ? s : `0x${s}`;
}

function resolveOracleFeedForPool(config: NaviConfig, pool: NaviPoolRow): NaviOracleFeedRef | null {
  if (typeof pool.oracleId === "number" && Number.isFinite(pool.oracleId)) {
    const byOracle = config.oracleFeeds?.find((f) => f.oracleId === pool.oracleId);
    if (byOracle) return byOracle;
  }
  const key = normalizeCoinTypeKey(pool.coinType);
  for (const f of config.oracleFeeds ?? []) {
    if (normalizeCoinTypeKey(f.coinType) === key) return f;
  }
  return null;
}

/** Navi docs: placeholder until Switchboard is fully enabled. */
const NAVI_ORACLE_SWITCHBOARD_PLACEHOLDER =
  "0x1fa7566f40f93cdbafd5a029a231e06664219444debb59beec2fe3f19ca08b7e";

function resolveSuiOracleFeed(config: NaviConfig): NaviOracleFeedRef | null {
  for (const f of config.oracleFeeds ?? []) {
    if (f.oracleId === 0) return f;
    const k = normalizeCoinTypeKey(f.coinType);
    if (k.endsWith("::sui::sui")) return f;
  }
  return null;
}

/**
 * Navi rejects withdraw/borrow if aggregated oracle prices are older than ~15s (abort 1502).
 * Must use `update_single_price_v2` (legacy `update_single_price` is deprecated — extra Switchboard arg).
 * @see https://naviprotocol.gitbook.io/navi-protocol-developer-docs/
 */
function appendOracleSinglePriceUpdateV2(tx: Transaction, config: NaviConfig, feed: NaviOracleFeedRef): void {
  if (!config.oraclePackageId || !config.oracleConfigObjectId || !config.supraOracleHolderId) {
    throw new Error("Navi oracle configuration is incomplete.");
  }
  const switchboardId = config.switchboardAggregatorId ?? NAVI_ORACLE_SWITCHBOARD_PLACEHOLDER;
  tx.moveCall({
    target: `${config.oraclePackageId}::oracle_pro::update_single_price_v2`,
    arguments: [
      tx.object(CLOCK_ID),
      tx.object(config.oracleConfigObjectId),
      tx.object(config.priceOracle),
      tx.object(config.supraOracleHolderId),
      tx.object(feed.pythPriceInfoObject),
      tx.object(switchboardId),
      tx.pure.address(feed.feedId),
    ],
  });
}

/** Refresh Navi oracle for SUI (if distinct) then the pool asset — reduces 1502 when calculator needs both. */
function appendOracleUpdatesForWithdraw(tx: Transaction, config: NaviConfig, poolFeed: NaviOracleFeedRef): void {
  const suiFeed = resolveSuiOracleFeed(config);
  if (suiFeed && normalizeCoinTypeKey(suiFeed.coinType) !== normalizeCoinTypeKey(poolFeed.coinType)) {
    appendOracleSinglePriceUpdateV2(tx, config, suiFeed);
  }
  appendOracleSinglePriceUpdateV2(tx, config, poolFeed);
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

async function selectMinimumCoins(
  client: SuiJsonRpcClient,
  owner: string,
  coinType: string,
  requiredAmount: bigint,
  symbol: string,
): Promise<{ objectId: string; balance: string }[]> {
  const allCoins = await fetchAllCoinObjects(client, owner, coinType);
  if (allCoins.length === 0) {
    throw new Error(`No ${symbol} coins found in wallet`);
  }
  allCoins.sort((a, b) => {
    const ba = BigInt(a.balance);
    const bb = BigInt(b.balance);
    if (bb > ba) return 1;
    if (bb < ba) return -1;
    return 0;
  });
  const selected: { objectId: string; balance: string }[] = [];
  let accumulated = 0n;
  for (const coin of allCoins) {
    if (accumulated >= requiredAmount) break;
    selected.push({ objectId: coin.coinObjectId, balance: coin.balance });
    accumulated += BigInt(coin.balance);
  }
  if (accumulated < requiredAmount) {
    throw new Error(
      `Insufficient ${symbol} balance. Required: ${requiredAmount.toString()}, available: ${accumulated.toString()}`,
    );
  }
  return selected;
}

/** Resolve spend coin from wallet or use a piped coin from a prior PTB step. */
async function resolveDepositCoin(
  tx: Transaction,
  client: SuiJsonRpcClient,
  params: {
    pool: NaviPoolRow;
    amountRaw: bigint;
    senderAddress: string;
    inputCoin?: TransactionObjectArgument;
  },
): Promise<TransactionObjectArgument> {
  const { pool, amountRaw, senderAddress, inputCoin } = params;
  const isSui = isNormalizedSuiNativeCoin(pool.coinType);

  if (inputCoin) {
    const [depositCoin] = tx.splitCoins(inputCoin, [amountRaw]);
    return depositCoin;
  }

  if (isSui) {
    const [coinToDeposit] = tx.splitCoins(tx.gas, [amountRaw]);
    return coinToDeposit;
  }

  const selectedCoins = await selectMinimumCoins(client, senderAddress, pool.coinType, amountRaw, pool.symbol);
  const primaryCoin = tx.object(selectedCoins[0].objectId);
  if (selectedCoins.length > 1) {
    const otherCoins = selectedCoins.slice(1).map((c) => tx.object(c.objectId));
    tx.mergeCoins(primaryCoin, otherCoins);
  }
  const [coinToDeposit] = tx.splitCoins(primaryCoin, [amountRaw]);
  return coinToDeposit;
}

/**
 * Append Navi deposit commands to an existing PTB (optional piped input coin).
 */
export async function buildNaviDepositIntoTransaction(
  ctx: TransactionBuildContext,
  params: {
    pool: NaviPoolRow;
    amountRaw: bigint;
    inputCoin?: TransactionObjectArgument;
    outputAlias?: string;
  },
): Promise<void> {
  const config = await fetchNaviConfig();
  const client = getSuiClientForEnvironment(ctx.suiEnvironment);
  const { tx } = ctx;
  const coinToDeposit = await resolveDepositCoin(tx, client, {
    pool: params.pool,
    amountRaw: params.amountRaw,
    senderAddress: ctx.senderAddress,
    inputCoin: params.inputCoin,
  });

  tx.moveCall({
    target: `${config.protocolPackage}::incentive_v3::entry_deposit`,
    arguments: [
      tx.object(CLOCK_ID),
      tx.object(config.storageId),
      tx.object(params.pool.poolObjectId),
      tx.pure.u8(params.pool.assetId),
      coinToDeposit,
      tx.pure.u64(params.amountRaw),
      tx.object(config.incentiveV2),
      tx.object(config.incentiveV3),
    ],
    typeArguments: [params.pool.coinType],
  });

  if (params.outputAlias) {
    ctx.aliases.set(params.outputAlias, coinToDeposit);
  }
  console.info("[navi] deposit command appended", params.pool.symbol, params.amountRaw.toString());
}

export async function buildNaviDepositTransactionBytes(params: {
  pool: NaviPoolRow;
  amountRaw: bigint;
  senderAddress: string;
  env: SuiChainEnvironment;
}): Promise<Uint8Array> {
  const client = getSuiClientForEnvironment(params.env);
  const ctx: TransactionBuildContext = {
    tx: new Transaction(),
    senderAddress: params.senderAddress,
    suiEnvironment: params.env,
    aliases: new Map(),
  };
  ctx.tx.setSender(params.senderAddress);
  await buildNaviDepositIntoTransaction(ctx, {
    pool: params.pool,
    amountRaw: params.amountRaw,
  });
  return ctx.tx.build({ client });
}

export async function buildNaviWithdrawTransactionBytes(params: {
  pool: NaviPoolRow;
  amountRaw: bigint;
  senderAddress: string;
  env: SuiChainEnvironment;
  feeAmountRaw: bigint;
  treasuryAddress: string | null;
}): Promise<Uint8Array> {
  const config = await fetchNaviConfig(true);
  const client = getSuiClientForEnvironment(params.env);
  const tx = new Transaction();
  tx.setSender(params.senderAddress);
  const pool = params.pool;
  const amountRaw = params.amountRaw;

  const feed = resolveOracleFeedForPool(config, pool);
  if (
    !feed ||
    !config.oraclePackageId ||
    !config.oracleConfigObjectId ||
    !config.supraOracleHolderId
  ) {
    throw new Error(
      "Could not resolve Navi oracle feeds for this asset (needed for withdraw). Check your connection and try again.",
    );
  }
  appendOracleUpdatesForWithdraw(tx, config, feed);

  const [withdrawnBalance] = tx.moveCall({
    target: `${config.protocolPackage}::incentive_v3::withdraw_v2`,
    arguments: [
      tx.object(CLOCK_ID),
      tx.object(config.priceOracle),
      tx.object(config.storageId),
      tx.object(pool.poolObjectId),
      tx.pure.u8(pool.assetId),
      tx.pure.u64(amountRaw),
      tx.object(config.incentiveV2),
      tx.object(config.incentiveV3),
      tx.object(SUI_SYSTEM_ID),
    ],
    typeArguments: [pool.coinType],
  });

  const [withdrawnCoin] = tx.moveCall({
    target: `0x2::coin::from_balance`,
    arguments: [withdrawnBalance],
    typeArguments: [pool.coinType],
  });

  if (params.feeAmountRaw > 0n && params.treasuryAddress) {
    const [feeCoin] = tx.splitCoins(withdrawnCoin, [params.feeAmountRaw]);
    tx.transferObjects([feeCoin], params.treasuryAddress);
  }

  tx.transferObjects([withdrawnCoin], params.senderAddress);

  return tx.build({ client });
}
