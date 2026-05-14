import type { SuiChainEnvironment } from "../config/chains/sui";
import type { TokenBalanceView } from "../types/blockchain";
import type { AssistantStructuredResult } from "./assistantResultTypes";

export function networkDisplay(env: SuiChainEnvironment): string {
  return env.charAt(0).toUpperCase() + env.slice(1);
}

export function portfolioFromBalances(
  env: SuiChainEnvironment,
  balances: TokenBalanceView[],
): AssistantStructuredResult {
  const network = networkDisplay(env);
  const assets = balances.map((b) => ({
    symbol: b.symbol,
    name: b.symbol,
    balanceFormatted: b.balanceFormatted,
    valueUsd: b.usdValue,
    coinType: b.coinType,
  }));

  let totalUsd: string | undefined;
  const priced = balances.filter((b) => b.usdValue != null && b.usdValue !== "");
  if (priced.length > 0) {
    let sum = 0;
    let ok = true;
    for (const b of priced) {
      const n = Number.parseFloat((b.usdValue as string).replace(/[^0-9.-]/g, ""));
      if (Number.isNaN(n)) {
        ok = false;
        break;
      }
      sum += n;
    }
    if (ok) totalUsd = sum.toFixed(2);
  }

  return {
    type: "portfolio_summary",
    network,
    totalUsd,
    assets,
  };
}
