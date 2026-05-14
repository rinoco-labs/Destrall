import type { TokenBalanceView } from "../../types/blockchain";
import type { DailyBriefMarketSummary } from "./daily-brief-types";

function parseUsd(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function buildMarketSummaryFromHoldings(balances: TokenBalanceView[]): DailyBriefMarketSummary {
  const priced = balances
    .map((b) => ({
      b,
      usd: parseUsd(b.usdValue),
      chg: b.usdPriceChange24hPct,
    }))
    .filter((x) => x.usd != null && x.chg != null && Number.isFinite(x.chg)) as {
      b: TokenBalanceView;
      usd: number;
      chg: number;
    }[];

  if (priced.length === 0) {
    return {
      trend: "unknown",
      portfolioDayChangePct: null,
      marketSentiment: "Not enough live 24h price data on your holdings to infer a portfolio move today.",
      heldMovers: [],
    };
  }

  const totalUsd = priced.reduce((s, x) => s + x.usd, 0);
  let w = 0;
  for (const x of priced) {
    w += (x.usd / totalUsd) * x.chg;
  }
  const portfolioDayChangePct = Number.isFinite(w) ? w : null;

  let trend: DailyBriefMarketSummary["trend"] = "flat";
  if (portfolioDayChangePct != null) {
    if (portfolioDayChangePct > 0.35) trend = "up";
    else if (portfolioDayChangePct < -0.35) trend = "down";
    else trend = "flat";
  }

  const heldMovers = [...priced]
    .sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg))
    .slice(0, 4)
    .map((x) => ({ symbol: x.b.symbol, change24hPct: x.chg }));

  let marketSentiment = "";
  if (portfolioDayChangePct == null) {
    marketSentiment = "Live 24h moves are unavailable for part of the priced subset.";
  } else if (trend === "up") {
    marketSentiment = `Your priced holdings are collectively up about ${portfolioDayChangePct.toFixed(1)}% over 24h (Aftermath marks on tokens you hold).`;
  } else if (trend === "down") {
    marketSentiment = `Your priced holdings are collectively down about ${Math.abs(portfolioDayChangePct).toFixed(1)}% over 24h (Aftermath marks on tokens you hold).`;
  } else {
    marketSentiment =
      "Your priced holdings are roughly flat over 24h — no large synchronized move detected in the subset with quotes.";
  }

  return {
    trend,
    portfolioDayChangePct,
    marketSentiment,
    heldMovers,
  };
}
