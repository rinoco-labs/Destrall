import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TokenBalanceView } from "../../types/blockchain.ts";
import {
  compareTokenAmounts,
  formatTokenAmount,
  insufficientBalanceMessage,
  parseTokenAmount,
} from "./amounts.ts";

const USDC_TYPE =
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
const CUSTOM_TYPE = "0xabc::custom::TOKEN";

function validateSpendLikeSend(
  amountDisplay: string,
  balance: TokenBalanceView,
): { ok: true; amountRaw: bigint } | { ok: false; message: string } {
  try {
    const amountRaw = parseTokenAmount(amountDisplay.trim(), balance.decimals, balance.symbol);
    const available = BigInt(balance.balanceRaw);
    if (compareTokenAmounts(amountRaw, available) === "gt") {
      return {
        ok: false,
        message: insufficientBalanceMessage({
          symbol: balance.symbol,
          requiredRaw: amountRaw,
          availableRaw: available,
          decimals: balance.decimals,
          actionLabel: "This send",
        }),
      };
    }
    return { ok: true, amountRaw };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid amount" };
  }
}

/** Mirrors home-page balance row construction without RPC (smoke test). */
function buildHomeBalanceRows(): TokenBalanceView[] {
  const specs = [
    { symbol: "SUI", coinType: "0x2::sui::SUI", decimals: 9, balanceRaw: "2023641727" },
    { symbol: "USDC", coinType: USDC_TYPE, decimals: 6, balanceRaw: "100106216" },
    { symbol: "CUSTOM", coinType: CUSTOM_TYPE, decimals: 8, balanceRaw: "150000000" },
  ];
  return specs.map((s) => ({
    ...s,
    balanceFormatted: formatTokenAmount(BigInt(s.balanceRaw), s.decimals),
  }));
}

describe("token amount consistency (home vs assistant)", () => {
  it("home balance formatting matches assistant spend validation for same wallet rows", () => {
    const homeRows = buildHomeBalanceRows();
    assert.equal(homeRows.length, 3);

    for (const row of homeRows) {
      const recomputed = formatTokenAmount(BigInt(row.balanceRaw), row.decimals);
      assert.equal(recomputed, row.balanceFormatted, `${row.symbol} home formatting`);

      const spend = validateSpendLikeSend(row.balanceFormatted, row);
      assert.equal(spend.ok, true, `${row.symbol} assistant validation`);
      if (spend.ok) {
        assert.equal(spend.amountRaw, BigInt(row.balanceRaw), `${row.symbol} raw units`);
      }
    }
  });

  it("USDC send 1 produces raw 1000000 in assistant path", () => {
    const wallet: TokenBalanceView = {
      symbol: "USDC",
      coinType: USDC_TYPE,
      decimals: 6,
      balanceRaw: "100106216",
      balanceFormatted: "100.106216",
    };
    const homeFormatted = formatTokenAmount(BigInt(wallet.balanceRaw), wallet.decimals);
    assert.equal(homeFormatted, wallet.balanceFormatted);

    const spend = validateSpendLikeSend("1", wallet);
    assert.equal(spend.ok, true);
    if (spend.ok) {
      assert.equal(spend.amountRaw, 1_000_000n);
    }
  });
});
