import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_SLIPPAGE_DECIMAL,
  formatSlippageBpsForDisplay,
  formatSlippageForDisplay,
  MAX_SLIPPAGE_DECIMAL,
  MIN_SLIPPAGE_DECIMAL,
  normalizeSlippage,
  SlippageError,
  slippageBpsToDecimal,
  slippageDecimalToBps,
  toAftermathSlippage,
  validateSlippage,
} from "./slippage.ts";

describe("normalizeSlippage", () => {
  it("decimal 0.01 stays 0.01", () => {
    assert.equal(normalizeSlippage(0.01, { inputFormat: "decimal" }), 0.01);
  });

  it("percent 1 converts to 0.01", () => {
    assert.equal(normalizeSlippage(1, { inputFormat: "percent" }), 0.01);
  });

  it('percent string "1" converts to 0.01', () => {
    assert.equal(normalizeSlippage("1", { inputFormat: "percent" }), 0.01);
  });

  it('percent string "1%" converts to 0.01', () => {
    assert.equal(normalizeSlippage("1%"), 0.01);
  });

  it("bps 100 converts to 0.01", () => {
    assert.equal(normalizeSlippage(100, { inputFormat: "bps" }), 0.01);
  });

  it("undefined becomes default 0.01", () => {
    assert.equal(normalizeSlippage(undefined), DEFAULT_SLIPPAGE_DECIMAL);
  });

  it("rejects negative input", () => {
    assert.throws(() => normalizeSlippage(-0.01), SlippageError);
  });

  it("rejects zero", () => {
    assert.throws(() => normalizeSlippage(0), SlippageError);
  });

  it("rejects NaN", () => {
    assert.throws(() => normalizeSlippage(Number.NaN), SlippageError);
  });

  it("rejects values above max", () => {
    assert.throws(() => normalizeSlippage(0.06, { inputFormat: "decimal" }), SlippageError);
  });

  it("accepts minimum 0.001", () => {
    assert.equal(normalizeSlippage(MIN_SLIPPAGE_DECIMAL, { inputFormat: "decimal" }), 0.001);
  });

  it("accepts maximum 0.05", () => {
    assert.equal(normalizeSlippage(MAX_SLIPPAGE_DECIMAL, { inputFormat: "decimal" }), 0.05);
  });
});

describe("formatSlippageForDisplay", () => {
  it("converts 0.01 to 1%", () => {
    assert.equal(formatSlippageForDisplay(0.01), "1%");
  });

  it("converts 0.005 to 0.5%", () => {
    assert.equal(formatSlippageForDisplay(0.005), "0.5%");
  });
});

describe("toAftermathSlippage", () => {
  it("100 bps → 0.01 for Aftermath API", () => {
    assert.equal(toAftermathSlippage(100), 0.01);
  });

  it("50 bps → 0.005", () => {
    assert.equal(toAftermathSlippage(50), 0.005);
  });

  it("rejects 1 bps (below minimum)", () => {
    assert.throws(() => toAftermathSlippage(1), SlippageError);
  });
});

describe("slippage conversions", () => {
  it("round-trips decimal and bps", () => {
    assert.equal(slippageDecimalToBps(0.01), 100);
    assert.equal(slippageBpsToDecimal(100), 0.01);
    assert.equal(formatSlippageBpsForDisplay(100), "1%");
  });
});

describe("validateSlippage", () => {
  it("rejects 0.0001 below minimum", () => {
    assert.throws(() => validateSlippage(0.0001), SlippageError);
  });
});
