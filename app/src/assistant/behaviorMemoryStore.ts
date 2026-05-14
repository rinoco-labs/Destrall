import type { ChainActivityItem } from "../types/blockchain";

const yieldOptimizationHits = new Map<string, number>();

export function recordYieldOptimizationQuery(accountId: string): void {
  yieldOptimizationHits.set(accountId, (yieldOptimizationHits.get(accountId) ?? 0) + 1);
}

export function behaviorMemoryLines(accountId: string): string[] {
  const n = yieldOptimizationHits.get(accountId) ?? 0;
  if (n >= 2) {
    return ["Behavior hint: user often explores yield maximization — keep protocol and volatility caveats explicit."];
  }
  return [];
}

export function formatActivityCaption(items: ChainActivityItem[], networkLabel: string): string {
  if (items.length === 0) {
    return `No recent indexed activity lines for ${networkLabel} yet (or RPC returned empty).`;
  }
  const lines = items.slice(0, 6).map((it) => {
    const ts = it.timestamp != null ? new Date(it.timestamp).toISOString() : "?";
    const amt = it.amount ? `${it.amount} ${it.symbol ?? ""}` : "";
    return `• ${ts} — ${it.type} (${it.status})${amt ? ` — ${amt}` : ""}`;
  });
  return [`Recent on-chain activity (${networkLabel}):`, ...lines].join("\n").slice(0, 1200);
}
