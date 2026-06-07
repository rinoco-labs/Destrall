import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TokenBalanceView } from "../../../types/blockchain.ts";
import {
  compareTokenAmounts,
  formatTokenAmount,
  insufficientBalanceMessage,
  parseTokenAmount,
  TokenAmountError,
} from "../../../shared/tokens/amounts.ts";
import { expandUserTokenAlias, tokenLabelsMatch } from "../../../services/tokens/tokenAliases.ts";

const USDC_TYPE =
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";

function walletBalances(): TokenBalanceView[] {
  return [
    {
      symbol: "USDC",
      coinType: USDC_TYPE,
      decimals: 6,
      balanceRaw: "100106216",
      balanceFormatted: "100.106216",
    },
    {
      symbol: "SUI",
      coinType: "0x2::sui::SUI",
      decimals: 9,
      balanceRaw: "2000000000",
      balanceFormatted: "2",
    },
  ];
}

function resolveSpendBalance(userToken: string, balances: TokenBalanceView[]): TokenBalanceView | null {
  const canonical = expandUserTokenAlias(userToken);
  for (const b of balances) {
    if (tokenLabelsMatch(canonical, b.symbol) || tokenLabelsMatch(userToken, b.symbol)) {
      return b;
    }
  }
  return null;
}

function simulateSendPrepare(params: {
  token: string;
  amount: string;
  balances: TokenBalanceView[];
}):
  | { ok: true; decimals: number; symbol: string; amountRaw: bigint }
  | { ok: false; message: string } {
  const balance = resolveSpendBalance(params.token, params.balances);
  if (!balance) return { ok: false, message: "Token not found in wallet." };
  try {
    const amountRaw = parseTokenAmount(params.amount.trim(), balance.decimals, balance.symbol);
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
    return { ok: true, decimals: balance.decimals, symbol: balance.symbol, amountRaw };
  } catch (e) {
    return { ok: false, message: e instanceof TokenAmountError ? e.message : "Invalid amount" };
  }
}

describe("prepareSendAction amount pipeline", () => {
  it("send 1 USDC uses 6 decimals (raw 1000000)", () => {
    const result = simulateSendPrepare({ token: "usdc", amount: "1", balances: walletBalances() });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.decimals, 6);
      assert.equal(result.symbol, "USDC");
      assert.equal(result.amountRaw, 1_000_000n);
      assert.notEqual(result.amountRaw, 1_000_000_000n);
    }
  });

  it("send 1 SUI uses 9 decimals", () => {
    const result = simulateSendPrepare({ token: "sui", amount: "1", balances: walletBalances() });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.decimals, 9);
      assert.equal(result.amountRaw, 1_000_000_000n);
    }
  });

  it("resolves nUSDC alias before amount conversion", () => {
    assert.equal(expandUserTokenAlias("nUSDC"), "USDC");
    const result = simulateSendPrepare({ token: "nUSDC", amount: "1", balances: walletBalances() });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.decimals, 6);
      assert.equal(result.symbol, "USDC");
    }
  });

  it("rejects too many decimal places for USDC", () => {
    const result = simulateSendPrepare({
      token: "usdc",
      amount: "0.0000001",
      balances: walletBalances(),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /6 decimal places/);
  });

  it("shows specific insufficient balance message", () => {
    const result = simulateSendPrepare({ token: "usdc", amount: "200", balances: walletBalances() });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /100\.106216 USDC/);
      assert.match(result.message, /200 USDC/);
    }
  });

  it("home and assistant agree on USDC balance display", () => {
    const wallet = walletBalances()[0];
    const formatted = formatTokenAmount(BigInt(wallet.balanceRaw), wallet.decimals);
    assert.equal(formatted, wallet.balanceFormatted);
  });
});
