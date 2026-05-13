import type { SuiChainEnvironment } from "../../../../config/chains/sui";

export type NaviRiskLabel = "low" | "medium" | "high";

/** One row from open-api `data.oracle.feeds` — used to refresh prices before withdraw/borrow. */
export type NaviOracleFeedRef = {
  oracleId: number;
  assetId: number;
  coinType: string;
  feedId: string;
  pythPriceInfoObject: string;
};

export type NaviConfig = {
  protocolPackage: string;
  storageId: string;
  incentiveV2: string;
  incentiveV3: string;
  priceOracle: string;
  reserveParentId: string;
  /** Present when config API returns `oracle` (needed to avoid stale-price abort 1502 on withdraw). */
  oraclePackageId?: string;
  oracleConfigObjectId?: string;
  supraOracleHolderId?: string;
  /** Switchboard placeholder object for `oracle_pro::update_single_price_v2` (from open-api). */
  switchboardAggregatorId?: string;
  oracleFeeds?: NaviOracleFeedRef[];
};

/** Pool row merged from Navi API + derived fields for assistant UI. */
export type NaviPoolRow = {
  assetId: number;
  /** Lending oracle id from API; matches `oracle.feeds[].oracleId` for price refresh. */
  oracleId?: number;
  coinType: string;
  symbol: string;
  decimals: number;
  supplyApy: number;
  borrowApy?: number;
  totalSupplyRaw: string;
  totalBorrowRaw: string;
  reserveId: string;
  poolObjectId: string;
  priceUsd?: number;
  risk: NaviRiskLabel;
};

export type NaviPositionView = {
  protocol: "Navi";
  assetSymbol: string;
  coinType: string;
  suppliedRaw: string;
  suppliedFormatted: string;
  currentValueRaw?: string;
  currentValueFormatted?: string;
  apy: number;
  poolObjectId: string;
  risk: NaviRiskLabel;
};
export type NaviYieldProposalKind = "deposit" | "withdraw";

/** Persisted on proposal cards for reload + execution validation (no secrets). */
export type NaviYieldProposalSnapshotV1 = {
  v: 1;
  kind: NaviYieldProposalKind;
  accountId: string;
  suiEnvironment: SuiChainEnvironment;
  walletAddress: string;
  assetSymbol: string;
  coinType: string;
  decimals: number;
  assetId: number;
  poolObjectId: string;
  reserveId: string;
  amountRaw: string;
  amountDisplay: string;
  /** Withdraw-only: fee taken from withdrawn coin to treasury (raw units). */
  feeAmountRaw: string;
  treasuryAddress?: string;
  supplyApyAtPrepare: number;
  preparedAtMs: number;
  expiresAtMs: number;
};
