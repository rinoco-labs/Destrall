import type { NaviPoolRow } from "../packages/core/yield/navi/navi.types";
import type { SwapProposalSnapshotV1 } from "../packages/core/swap/swap.types";
import type { NaviYieldProposalSnapshotV1 } from "../packages/core/yield/navi/navi.types";

export type PendingClarificationKind = "rebalance_distribution" | "schedule_ampm" | null;

export type PendingScheduleClarification = {
  partialHour: number;
  dateLabel: string;
  originalText: string;
};

export type ParsedRebalanceTarget = { symbol: string; pct: number };

export type ConversationTurnContext = {
  lastMentionedPool?: Pick<
    NaviPoolRow,
    "symbol" | "coinType" | "supplyApy" | "decimals" | "assetId" | "poolObjectId" | "reserveId" | "risk"
  >;
  lastMentionedToken?: string;
  lastYieldRecommendation?: string;
  lastSwapQuoteSummary?: string;
  lastActionProposalSummary?: string;
  pendingClarification?: PendingClarificationKind;
  pendingSchedule?: PendingScheduleClarification;
  parsedRebalanceTargets?: ParsedRebalanceTarget[];
  recentUserIntent?: string;
  /** After a staged swap+deposit plan, user can say “deposit now”. */
  pendingPostSwapDeposit?: { poolAssetSymbol: string; amountDisplayHint?: string };
};

const store = new Map<string, ConversationTurnContext>();

function key(accountId: string, chatId: string): string {
  return `${accountId}\t${chatId}`;
}

export function getConversationContext(accountId: string, chatId: string): ConversationTurnContext {
  return store.get(key(accountId, chatId)) ?? {};
}

export function setConversationContext(
  accountId: string,
  chatId: string,
  patch: Partial<ConversationTurnContext>,
): ConversationTurnContext {
  const k = key(accountId, chatId);
  const prev = store.get(k) ?? {};
  const next = { ...prev, ...patch };
  store.set(k, next);
  return next;
}

export function clearConversationField<K extends keyof ConversationTurnContext>(
  accountId: string,
  chatId: string,
  field: K,
): void {
  const k = key(accountId, chatId);
  const prev = store.get(k);
  if (!prev) return;
  const next = { ...prev };
  delete next[field];
  store.set(k, next);
}

/** Non-secret summaries for tool routing (never store mnemonics, keys, PIN). */
export function recordProposalContext(
  accountId: string,
  chatId: string,
  kind: "swap" | "yield_deposit" | "yield_withdraw" | "send",
  snapshot?: SwapProposalSnapshotV1 | NaviYieldProposalSnapshotV1 | { summary: string },
): void {
  if (kind === "swap" && snapshot && "fromSymbol" in snapshot) {
    setConversationContext(accountId, chatId, {
      lastSwapQuoteSummary: `${snapshot.fromSymbol} → ${snapshot.toSymbol}`,
      lastMentionedToken: snapshot.toSymbol,
    });
  } else if (kind === "yield_deposit" && snapshot && "assetSymbol" in snapshot) {
    setConversationContext(accountId, chatId, {
      lastMentionedToken: snapshot.assetSymbol,
      lastActionProposalSummary: `Navi deposit ${snapshot.amountDisplay} ${snapshot.assetSymbol}`,
    });
  } else if (kind === "send" && snapshot && "summary" in snapshot) {
    setConversationContext(accountId, chatId, { lastActionProposalSummary: snapshot.summary });
  } else if (kind === "yield_withdraw" && snapshot && "assetSymbol" in snapshot) {
    setConversationContext(accountId, chatId, {
      lastMentionedToken: snapshot.assetSymbol,
      lastActionProposalSummary: `Navi withdraw ${snapshot.amountDisplay} ${snapshot.assetSymbol}`,
    });
  }
}
