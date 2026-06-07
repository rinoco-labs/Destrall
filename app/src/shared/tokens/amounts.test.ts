import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { TokenBalanceView } from "../../types/blockchain.ts";
import {
  compareTokenAmounts,
  formatTokenAmount,
  parseTokenAmount,
  SUI_DECIMALS,
  TokenAmountError,
  getTokenDecimalsFromBalance,
} from "./amounts.ts";
import { expandUserTokenAlias, tokenLabelsMatch, findTokenAliasGroup } from "../../services/tokens/tokenAliases.ts";

const USDC_TYPE =
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";

function bal(partial: Partial<TokenBalanceView> & Pick<TokenBalanceView, "symbol" | "coinType">): TokenBalanceView {
  return {
    decimals: 6,
    balanceRaw: "100000000",
    balanceFormatted: "100",
    ...partial,
  };
}

describe("parseTokenAmount / formatTokenAmount", () => {
  it("USDC 6 decimals: 1 → 1000000", () => {
    assert.equal(parseTokenAmount("1", 6), 1_000_000n);
    assert.equal(parseTokenAmount("1.5", 6), 1_500_000n);
    assert.equal(parseTokenAmount("0.01", 6), 10_000n);
    assert.equal(parseTokenAmount("0.000001", 6), 1n);
  });

  it("USDC rejects too many decimal places", () => {
    assert.throws(() => parseTokenAmount("0.0000001", 6, "USDC"), TokenAmountError);
  });

  it("SUI 9 decimals", () => {
    assert.equal(parseTokenAmount("1", SUI_DECIMALS), 1_000_000_000n);
    assert.equal(parseTokenAmount("0.000000001", SUI_DECIMALS), 1n);
  });

  it("round-trips arbitrary decimals without floating point", () => {
    const cases: Array<[string, number, string]> = [
      ["42", 0, "42"],
      ["1.25", 2, "125"],
      ["0.01", 6, "10000"],
      ["1.5", 8, "150000000"],
      ["0.000000001", 9, "1"],
      ["0.000000000000000001", 18, "1"],
    ];
    for (const [human, decimals, rawStr] of cases) {
      assert.equal(parseTokenAmount(human, decimals).toString(), rawStr);
      assert.equal(formatTokenAmount(BigInt(rawStr), decimals), human);
    }
  });

  it("compareTokenAmounts orders raw bigint values", () => {
    assert.equal(compareTokenAmounts(1n, 2n), "lt");
    assert.equal(compareTokenAmounts(2n, 2n), "eq");
    assert.equal(compareTokenAmounts(3n, 2n), "gt");
  });
});

describe("getTokenDecimalsFromBalance", () => {
  it("returns wallet balance decimals", () => {
    assert.equal(getTokenDecimalsFromBalance({ decimals: 6, symbol: "USDC" }), 6);
  });

  it("throws when decimals missing", () => {
    assert.throws(() => getTokenDecimalsFromBalance({ decimals: NaN, symbol: "X" }), TokenAmountError);
  });
});

describe("registry decimals (source of truth)", () => {
  it("USDC registry entry specifies 6 decimals", async () => {
    const { swappableTokensConfig } = await import("../../config/swappableTokens.config.ts");
    const usdc = swappableTokensConfig.sui.tokens.find((t) => t.symbol === "USDC");
    assert.equal(usdc?.decimals, 6);
  });
});

describe("tokenAliases", () => {
  it("maps usdc, USDC, and nUSDC to the USDC group", () => {
    assert.equal(expandUserTokenAlias("usdc"), "USDC");
    assert.equal(expandUserTokenAlias("USDC"), "USDC");
    assert.equal(expandUserTokenAlias("nUSDC"), "USDC");
    assert.equal(findTokenAliasGroup("nusdc")?.canonicalSymbol, "USDC");
    assert.ok(tokenLabelsMatch("usdc", "USDC"));
    assert.ok(tokenLabelsMatch("nUSDC", "USDC"));
  });
});

function validateSpendForTest(wallet: TokenBalanceView, amountDisplay: string) {
  const amountRaw = parseTokenAmount(amountDisplay, wallet.decimals, wallet.symbol);
  const available = BigInt(wallet.balanceRaw);
  if (compareTokenAmounts(amountRaw, available) === "gt") {
    return {
      ok: false as const,
      message: `You have ${formatTokenAmount(available, wallet.decimals)} ${wallet.symbol}, but this send requires ${amountDisplay} ${wallet.symbol}.`,
    };
  }
  return { ok: true as const, amountRaw };
}

describe("assistant send amount flow", () => {
  it("send 1 USDC uses 6 decimals (raw 1000000)", () => {
    const wallet = bal({
      symbol: "USDC",
      coinType: USDC_TYPE,
      balanceFormatted: "100.106216",
      balanceRaw: "100106216",
      decimals: 6,
    });
    const check = validateSpendForTest(wallet, "1");
    assert.equal(check.ok, true);
    if (check.ok) {
      assert.equal(check.amountRaw, 1_000_000n);
      assert.notEqual(check.amountRaw, 1_000_000_000n);
    }
  });

  it("send 1 SUI uses 9 decimals", () => {
    const wallet = bal({
      symbol: "SUI",
      coinType: "0x2::sui::SUI",
      balanceFormatted: "10",
      balanceRaw: "10000000000",
      decimals: 9,
    });
    const check = validateSpendForTest(wallet, "1");
    assert.equal(check.ok, true);
    if (check.ok) assert.equal(check.amountRaw, 1_000_000_000n);
  });

  it("home page and assistant formatting agree for USDC", () => {
    const raw = "100106216";
    const decimals = 6;
    const formatted = formatTokenAmount(BigInt(raw), decimals);
    const wallet = bal({
      symbol: "USDC",
      coinType: USDC_TYPE,
      balanceRaw: raw,
      balanceFormatted: formatted,
      decimals,
    });
    assert.equal(wallet.balanceFormatted, "100.106216");
    assert.equal(formatTokenAmount(BigInt(wallet.balanceRaw), wallet.decimals), wallet.balanceFormatted);
  });

  it("insufficient balance after correct conversion for 0.42 USDC", () => {
    const wallet = bal({
      symbol: "USDC",
      coinType: USDC_TYPE,
      balanceRaw: "420000",
      balanceFormatted: "0.42",
      decimals: 6,
    });
    const check = validateSpendForTest(wallet, "1");
    assert.equal(check.ok, false);
    if (!check.ok) {
      assert.match(check.message, /0\.42 USDC/);
      assert.match(check.message, /1 USDC/);
    }
  });

  it("allows send when 5 USDC requested and 100+ USDC held", () => {
    const wallet = bal({
      symbol: "USDC",
      coinType: USDC_TYPE,
      balanceRaw: "100106216",
      balanceFormatted: "100.106216",
      decimals: 6,
    });
    const check = validateSpendForTest(wallet, "5");
    assert.equal(check.ok, true);
  });
});
