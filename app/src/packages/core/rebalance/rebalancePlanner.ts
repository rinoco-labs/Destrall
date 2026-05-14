import { randomUUID } from "node:crypto";
import type { RebalanceProposalResult } from "../../../assistant/assistantResultTypes";
import type { TokenBalanceView } from "../../../types/blockchain";

const DUST_USD = 4.5;

export type NormalizedTarget = { symbol: string; pct: number };

/** Parse strings like "30% SUI, 10% WAL, 20% DEEP and the rest in USDC" */
export function parseRebalanceTargets(text: string): NormalizedTarget[] | null {
  const t = text.trim();
  if (!t) return null;
  const hasPct = /\d+\s*%/.test(t);
  if (!hasPct) return null;

  let restSymbol: string | null = null;
  let work = t;
  const restM = t.toLowerCase().match(/\b(?:and\s+)?the\s+rest\s+(?:in|as)?\s+(\w+)\b/);
  if (restM) {
    restSymbol = restM[1].toUpperCase();
    work = work.replace(/\b(?:and\s+)?the\s+rest\s+(?:in|as)?\s+\w+/i, "").trim();
  }

  const parts = work
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: NormalizedTarget[] = [];
  let explicitSum = 0;

  for (const part of parts) {
    const m = part.match(/^(\d+(?:\.\d+)?)\s*%\s*(?:of\s+)?(\w+)\s*$/i);
    if (!m) continue;
    const pct = parseFloat(m[1]);
    const sym = m[2].toUpperCase();
    if (!Number.isFinite(pct) || pct <= 0 || sym.length < 2) continue;
    explicitSum += pct;
    out.push({ symbol: sym, pct });
  }

  if (restSymbol) {
    const restPct = Math.max(0, 100 - explicitSum);
    if (restPct > 0.25) {
      out.push({ symbol: restSymbol, pct: restPct });
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
      if (d > DUST_USD && d > buyDelta) {
        buyer = s;
        buyDelta = d;
      }
    }
    if (!buyer || buyDelta <= DUST_USD) break;

    const sellers = [...work.entries()]
      .filter(([s, d]) => s !== buyer && d < -DUST_USD)
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
      if (units * rate < DUST_USD) continue;

      swaps.push({
        fromSymbol: seller,
        toSymbol: buyer,
        amountDisplay: formatAmt(seller, units),
        note: "Prepare each swap in the assistant or Swap tab; route may require an intermediate hop (for example via USDC).",
      });

      work.set(seller, sellDelta + moveUsd);
      work.set(buyer, (work.get(buyer) ?? 0) - moveUsd);
      progressed = true;
      break;
    }
    if (!progressed) break;
  }

  for (const [sym, d] of work) {
    if (Math.abs(d) > 0 && Math.abs(d) < DUST_USD) {
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
    "Swaps use live routes (Aftermath); amounts are estimates until each swap card is prepared.",
    "Gas is paid in SUI per transaction.",
    "Prices and APYs move — re-check before approving.",
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
