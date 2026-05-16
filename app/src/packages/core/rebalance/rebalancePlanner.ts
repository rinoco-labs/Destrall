import { randomUUID } from "node:crypto";
import type { RebalanceProposalResult } from "../../../assistant/assistantResultTypes";
import type { TokenBalanceView } from "../../../types/blockchain";

/** Floor / ceiling for per-leg notional filter (USD) */
const DUST_USD_MIN = 0.35;
const DUST_USD_MAX = 25;
/** Leg must be at least this fraction of portfolio value (e.g. 1.5% of ~$6 → ~$0.10, clamped to min) */
const DUST_PORTFOLIO_PCT = 0.015;
/** Minimum portfolio drift (%) for a single leg */
const MIN_DRIFT_PCT = 1.0;

/** Scale dust with portfolio size so small wallets are not treated as already balanced. */
export function rebalanceDustThresholdUsd(totalUsd: number): number {
  if (totalUsd <= 0) return DUST_USD_MIN;
  return Math.min(DUST_USD_MAX, Math.max(DUST_USD_MIN, totalUsd * DUST_PORTFOLIO_PCT));
}

export type NormalizedTarget = { symbol: string; pct: number };

/** Parse strings like "30% SUI, 10% WAL" or "Rebalance 30% Sui 20% WAL and the rest to USDC" */
export function parseRebalanceTargets(text: string): NormalizedTarget[] | null {
  const t = text.trim();
  if (!t) return null;
  const hasPct = /\d+\s*%/.test(t);
  if (!hasPct) return null;

  let work = t.replace(/^\s*rebalance(?:\s+my\s+portfolio)?\s+/i, "").trim();

  let restSymbol: string | null = null;
  const restM = work.toLowerCase().match(/\b(?:and\s+)?the\s+rest\s+(?:to|into|in|as)\s+(\w+)\b/);
  if (restM) {
    restSymbol = restM[1].toUpperCase();
    work = work.replace(/\b(?:and\s+)?the\s+rest\s+(?:to|into|in|as)\s+\w+/i, "").trim();
  }

  const out: NormalizedTarget[] = [];
  let explicitSum = 0;
  const pctRe = /(\d+(?:\.\d+)?)\s*%\s*(?:of\s+)?([a-zA-Z][a-zA-Z0-9]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = pctRe.exec(work)) !== null) {
    const pct = parseFloat(m[1]);
    const sym = m[2].toUpperCase();
    if (!Number.isFinite(pct) || pct <= 0 || sym.length < 2) continue;
    explicitSum += pct;
    const existing = out.find((row) => row.symbol === sym);
    if (existing) {
      existing.pct += pct;
    } else {
      out.push({ symbol: sym, pct });
    }
  }

  if (restSymbol) {
    const restPct = Math.max(0, 100 - explicitSum);
    if (restPct > 0.25) {
      const existing = out.find((row) => row.symbol === restSymbol);
      if (existing) {
        existing.pct += restPct;
      } else {
        out.push({ symbol: restSymbol, pct: restPct });
      }
    }
  }

  return out.length ? out : null;
}

export function normalizeTargets(
  targets: NormalizedTarget[],
): { ok: true; targets: NormalizedTarget[] } | { ok: false; error: string } {
  const sum = targets.reduce((a, t) => a + t.pct, 0);
  if (Math.abs(sum - 100) > 0.51) {
    return { ok: false, error: `Target weights must add up to 100% (currently ${sum.toFixed(1)}%).` };
  }
  const bySym = new Map<string, number>();
  for (const t of targets) {
    bySym.set(t.symbol, (bySym.get(t.symbol) ?? 0) + t.pct);
  }
  return { ok: true, targets: [...bySym.entries()].map(([symbol, pct]) => ({ symbol, pct })) };
}

export type AllocationRow = { symbol: string; valueUsd: number; pct: number };

export function calculateCurrentAllocation(balances: TokenBalanceView[]): AllocationRow[] {
  const rows: { symbol: string; valueUsd: number }[] = [];
  for (const b of balances) {
    const raw = b.usdValue?.replace(/[^0-9.-]/g, "") ?? "";
    const v = parseFloat(raw);
    if (!Number.isFinite(v) || v <= 0) continue;
    rows.push({ symbol: b.symbol.toUpperCase(), valueUsd: v });
  }
  const total = rows.reduce((a, r) => a + r.valueUsd, 0);
  if (total <= 0) return [];
  return rows.map((r) => ({
    symbol: r.symbol,
    valueUsd: r.valueUsd,
    pct: (100 * r.valueUsd) / total,
  }));
}

export function calculateTargetAllocation(totalUsd: number, targets: NormalizedTarget[]): AllocationRow[] {
  return targets.map((t) => ({
    symbol: t.symbol,
    valueUsd: (totalUsd * t.pct) / 100,
    pct: t.pct,
  }));
}

export type SwapDeltaLeg = {
  fromSymbol: string;
  toSymbol: string;
  amountDisplay: string;
  note?: string;
};

function parseBalanceUsd(b: TokenBalanceView): number {
  const raw = b.usdValue?.replace(/[^0-9.-]/g, "") ?? "";
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : 0;
}

/** Greedy pairing of surpluses to deficits on the sell side (approximate notionals). */
export function calculateSwapDeltas(
  current: AllocationRow[],
  target: NormalizedTarget[],
  balances: TokenBalanceView[],
): { swaps: SwapDeltaLeg[]; dustSkipped: string[] } {
  const dustSkipped: string[] = [];
  const totalUsd = current.reduce((a, c) => a + c.valueUsd, 0);
  if (totalUsd <= 0) {
    return { swaps: [], dustSkipped: ["No priced balances — add USD values or wait for prices to refresh."] };
  }

  const dustUsd = rebalanceDustThresholdUsd(totalUsd);
  console.info("[rebalance] dust threshold", { totalUsd: totalUsd.toFixed(2), dustUsd: dustUsd.toFixed(2) });

  const curVal = new Map(current.map((c) => [c.symbol, c.valueUsd]));
  const tgtVal = new Map(calculateTargetAllocation(totalUsd, target).map((r) => [r.symbol, r.valueUsd]));

  const symbols = new Set<string>([...curVal.keys(), ...tgtVal.keys()]);
  const delta = new Map<string, number>();
  for (const s of symbols) {
    delta.set(s, (tgtVal.get(s) ?? 0) - (curVal.get(s) ?? 0));
  }

  const balBySym = new Map(balances.map((b) => [b.symbol.toUpperCase(), b]));
  const usdPerUnit = (sym: string): number | null => {
    const b = balBySym.get(sym);
    if (!b) return null;
    const usd = parseBalanceUsd(b);
    const raw = parseFloat(b.balanceFormatted.replace(/,/g, ""));
    if (!Number.isFinite(raw) || raw <= 0 || usd <= 0) return null;
    return usd / raw;
  };

  const formatAmt = (sym: string, units: number): string => {
    const b = balBySym.get(sym);
    const d = b?.decimals ?? 6;
    const s = units.toFixed(Math.min(6, d));
    return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") || "0";
  };

  const swaps: SwapDeltaLeg[] = [];
  const work = new Map(delta);
  let guard = 0;

  while (guard++ < 64) {
    let buyer: string | null = null;
    let buyDelta = 0;
    for (const [s, d] of work) {
      if (d > dustUsd && d > buyDelta) {
        buyer = s;
        buyDelta = d;
      }
    }
    if (!buyer || buyDelta <= dustUsd) break;

    const sellers = [...work.entries()]
      .filter(([s, d]) => s !== buyer && d < -dustUsd)
      .sort((a, b) => a[1] - b[1]);

    let progressed = false;
    for (const [seller, sellDelta] of sellers) {
      const sellAmt = -sellDelta;
      const moveUsd = Math.min(buyDelta, sellAmt);
      const rate = usdPerUnit(seller);
      if (!rate) {
        dustSkipped.push(`Could not price ${seller} for swap sizing.`);
        continue;
      }
      const units = moveUsd / rate;
      if (units * rate < dustUsd) continue;

      const driftPct = (moveUsd / totalUsd) * 100;
      if (driftPct < MIN_DRIFT_PCT) {
        dustSkipped.push(`Skipped ${seller}→${buyer} (~${driftPct.toFixed(2)}% drift).`);
        continue;
      }

      swaps.push({
        fromSymbol: seller,
        toSymbol: buyer,
        amountDisplay: formatAmt(seller, units),
      });

      work.set(seller, sellDelta + moveUsd);
      work.set(buyer, (work.get(buyer) ?? 0) - moveUsd);
      progressed = true;
      break;
    }
    if (!progressed) break;
  }

  for (const [sym, d] of work) {
    if (Math.abs(d) > 0 && Math.abs(d) < dustUsd) {
      dustSkipped.push(`Ignored dust for ${sym} (~$${Math.abs(d).toFixed(2)}).`);
    }
  }

  return { swaps, dustSkipped };
}

export function buildRebalanceProposal(params: {
  network: string;
  current: AllocationRow[];
  target: NormalizedTarget[];
  swaps: SwapDeltaLeg[];
  dustSkipped: string[];
}): RebalanceProposalResult {
  const totalCur = params.current.reduce((a, c) => a + c.valueUsd, 0);
  const currentPct = params.current.map((c) => ({
    symbol: c.symbol,
    pct: `${c.pct.toFixed(1)}%`,
    valueUsd: totalCur > 0 ? `~$${c.valueUsd.toFixed(0)}` : undefined,
  }));
  const targetPct = params.target.map((t) => ({
    symbol: t.symbol,
    pct: `${t.pct.toFixed(1)}%`,
  }));
  const riskNotes = [
    "Swaps use live Aftermath routes bundled into one programmable transaction when you approve.",
    "Gas is paid in SUI once per rebalance PTB.",
    "Prices move — quotes expire; re-prepare if approval is delayed.",
  ];
  return {
    type: "rebalance_proposal",
    proposalId: randomUUID(),
    network: params.network,
    currentPct,
    targetPct,
    swaps: params.swaps,
    dustSkipped: params.dustSkipped.length ? params.dustSkipped : undefined,
    riskNotes,
    gasNote: "~One gas cost per swap leg (paid in SUI).",
  };
}
