import type { TokenBalanceView } from "../../types/blockchain";
import { normalizeSuiCoinType } from "../../main/services/chains/sui/sui-coin-type-normalize";
import {
  aliasesInGroup,
  findTokenAliasGroup,
  normalizeTokenInput,
  tokenLabelsMatch,
} from "./tokenAliases";
import { formatAvailableWalletTokens } from "./balanceValidation";

export type WalletTokenCandidate = {
  coinType: string;
  symbol: string;
  decimals: number;
  balanceRaw: string;
  balanceFormatted: string;
  matchScore: number;
  matchReason: string;
  source: "wallet";
};

export type ResolveWalletTokenOk = {
  kind: "resolved";
  balance: TokenBalanceView;
  userInput: string;
  matchReason: string;
};

export type ResolveWalletTokenAmbiguous = {
  kind: "ambiguous";
  userInput: string;
  candidates: WalletTokenCandidate[];
};

export type ResolveWalletTokenNotFound = {
  kind: "not_found";
  userInput: string;
  message: string;
  availableSymbols: string[];
};

export type ResolveWalletTokenResult =
  | ResolveWalletTokenOk
  | ResolveWalletTokenAmbiguous
  | ResolveWalletTokenNotFound;

export type ResolveWalletTokenOptions = {
  /** When true, only balances with raw amount > 0 are eligible (default true). */
  requirePositiveBalance?: boolean;
  /** Shortened address for safe debug logs. */
  walletAddress?: string;
  logContext?: string;
};

function balanceRawPositive(b: TokenBalanceView): boolean {
  try {
    return BigInt(b.balanceRaw) > 0n;
  } catch {
    return false;
  }
}

function coinTypeTail(coinType: string): string {
  return (coinType.split("::").pop() ?? "").toUpperCase();
}

function scoreCandidate(input: string, balance: TokenBalanceView): { score: number; reason: string } | null {
  const raw = input.trim();
  if (!raw) return null;

  const normInput = normalizeTokenInput(raw);
  const normCoin = normalizeSuiCoinType(balance.coinType);
  const inputAsCoin = raw.includes("::") ? normalizeSuiCoinType(raw) : null;

  if (inputAsCoin && normCoin === inputAsCoin) {
    return { score: 1000, reason: "exact_coin_type" };
  }

  const symUpper = balance.symbol.trim().toUpperCase();
  const inputUpper = raw.toUpperCase();

  if (symUpper === inputUpper) {
    return { score: 900, reason: "exact_symbol" };
  }

  if (coinTypeTail(balance.coinType) === inputUpper) {
    return { score: 850, reason: "coin_type_tail" };
  }

  if (tokenLabelsMatch(raw, balance.symbol)) {
    return { score: 800, reason: "alias_group" };
  }

  const group = findTokenAliasGroup(raw);
  if (group) {
    const groupAliases = aliasesInGroup(raw);
    const balNorm = normalizeTokenInput(balance.symbol);
    if (groupAliases.includes(balNorm)) {
      return { score: 750, reason: "alias_group_symbol" };
    }
    if (groupAliases.includes(normalizeTokenInput(coinTypeTail(balance.coinType)))) {
      return { score: 720, reason: "alias_group_tail" };
    }
  }

  if (symUpper.includes(inputUpper) || inputUpper.includes(symUpper)) {
    return { score: 400, reason: "partial_symbol" };
  }

  if (normInput && balance.coinType.toLowerCase().includes(normInput)) {
    return { score: 350, reason: "partial_coin_type" };
  }

  return null;
}

function dedupeByCoinType(candidates: WalletTokenCandidate[]): WalletTokenCandidate[] {
  const byType = new Map<string, WalletTokenCandidate>();
  for (const c of candidates) {
    const key = normalizeSuiCoinType(c.coinType);
    const prev = byType.get(key);
    if (!prev || c.matchScore > prev.matchScore) {
      byType.set(key, c);
    }
  }
  return [...byType.values()];
}

function logResolution(
  opts: ResolveWalletTokenOptions | undefined,
  detail: Record<string, unknown>,
): void {
  if (!opts?.logContext) return;
  const addr = opts.walletAddress ? `${opts.walletAddress.slice(0, 8)}…` : "unknown";
  console.info(`[token-resolver] ${opts.logContext}`, { wallet: addr, ...detail });
}

/**
 * Resolve user-entered token text against the active wallet's balance rows.
 * Wallet balances are the source of truth for spendable tokens.
 */
export function resolveWalletToken(
  input: string,
  balances: TokenBalanceView[],
  options?: ResolveWalletTokenOptions,
): ResolveWalletTokenResult {
  const userInput = input.trim();
  const requirePositive = options?.requirePositiveBalance !== false;

  logResolution(options, {
    rawInput: userInput,
    normalizedInput: normalizeTokenInput(userInput),
    balanceCount: balances.length,
  });

  if (!userInput) {
    return {
      kind: "not_found",
      userInput,
      message: "Enter a token symbol or coin type.",
      availableSymbols: balances.map((b) => b.symbol),
    };
  }

  const eligible = requirePositive ? balances.filter(balanceRawPositive) : balances;

  const scored: WalletTokenCandidate[] = [];
  for (const b of eligible) {
    const hit = scoreCandidate(userInput, b);
    if (!hit || hit.score < 350) continue;
    scored.push({
      coinType: b.coinType,
      symbol: b.symbol,
      decimals: b.decimals,
      balanceRaw: b.balanceRaw,
      balanceFormatted: b.balanceFormatted,
      matchScore: hit.score,
      matchReason: hit.reason,
      source: "wallet",
    });
  }

  const candidates = dedupeByCoinType(scored).sort((a, b) => b.matchScore - a.matchScore);

  logResolution(options, {
    candidateCount: candidates.length,
    candidates: candidates.map((c) => ({
      symbol: c.symbol,
      score: c.matchScore,
      reason: c.matchReason,
      balance: c.balanceFormatted,
    })),
  });

  if (candidates.length === 0) {
    const available = formatAvailableWalletTokens(balances);
    return {
      kind: "not_found",
      userInput,
      message: `I could not find a token matching "${userInput}" in your connected wallet. Available tokens: ${available}.`,
      availableSymbols: [...new Set(balances.filter(balanceRawPositive).map((b) => b.symbol))],
    };
  }

  const top = candidates[0];
  const second = candidates[1];

  if (
    second &&
    top.matchScore === second.matchScore &&
    normalizeSuiCoinType(top.coinType) !== normalizeSuiCoinType(second.coinType)
  ) {
    return { kind: "ambiguous", userInput, candidates };
  }

  if (top.matchScore < 700 && second && second.matchScore >= 700) {
    return { kind: "ambiguous", userInput, candidates: candidates.filter((c) => c.matchScore >= 700) };
  }

  if (candidates.length > 1 && top.matchScore < 800 && second && top.matchScore - second.matchScore < 100) {
    return { kind: "ambiguous", userInput, candidates };
  }

  const balance = balances.find((b) => normalizeSuiCoinType(b.coinType) === normalizeSuiCoinType(top.coinType));
  if (!balance) {
    return {
      kind: "not_found",
      userInput,
      message: `Could not load balance for resolved token "${top.symbol}".`,
      availableSymbols: [],
    };
  }

  logResolution(options, {
    selected: top.symbol,
    coinType: top.coinType,
    reason: top.matchReason,
    balance: top.balanceFormatted,
  });

  return { kind: "resolved", balance, userInput, matchReason: top.matchReason };
}

/** Find wallet balance row for an exact coin type (normalized). */
export function findWalletBalanceByCoinType(
  balances: TokenBalanceView[],
  coinType: string,
): TokenBalanceView | null {
  const want = normalizeSuiCoinType(coinType);
  return balances.find((b) => normalizeSuiCoinType(b.coinType) === want) ?? null;
}
