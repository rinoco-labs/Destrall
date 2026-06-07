import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatSlippageBpsForDisplay,
  normalizeSlippage,
  SlippageError,
  toAftermathSlippage,
} from "../../../shared/swap/slippage.ts";
import { prepareSwapInputSchema } from "./swap.schemas.ts";

function isAftermathSlippageError(errText: string): boolean {
  return /Error\s+2010/i.test(errText) || /Invalid slippage/i.test(errText);
}

function swapProposalSlippageLabel(slippageBps: number): string {
  return formatSlippageBpsForDisplay(slippageBps);
}

describe("swap slippage integration", () => {
  it("toAftermathSlippage(100) yields 0.01 for API", () => {
    assert.equal(toAftermathSlippage(100), 0.01);
  });

  it("proposal display shows 1% for 100 bps", () => {
    assert.equal(swapProposalSlippageLabel(100), "1%");
  });

  it("prepareSwapInputSchema rejects slippageBps: 1 before API call", () => {
    const parsed = prepareSwapInputSchema.safeParse({
      fromToken: "SUI",
      toToken: "USDC",
      amount: "1",
      slippageBps: 1,
    });
    assert.equal(parsed.success, false);
  });

  it("trigger path validates slippage before swap preparation", () => {
    assert.throws(() => toAftermathSlippage(1), SlippageError);
    assert.doesNotThrow(() => toAftermathSlippage(100));
  });

  it("normalizeSlippage never produces raw percent/bps values for API", () => {
    const cases: Array<{ input: unknown; format: "decimal" | "percent" | "bps" }> = [
      { input: 1, format: "percent" },
      { input: 100, format: "bps" },
      { input: "1%", format: "decimal" },
      { input: undefined, format: "decimal" },
    ];
    for (const c of cases) {
      const decimal = normalizeSlippage(c.input, { inputFormat: c.format });
      assert.ok(decimal > 0 && decimal <= 0.05);
      assert.notEqual(decimal, 1);
      assert.notEqual(decimal, 100);
      assert.notEqual(String(decimal), "1%");
      assert.notEqual(decimal, Number.NaN);
    }
  });

  it("isAftermathSlippageError detects Error 2010", () => {
    assert.equal(isAftermathSlippageError("HTTP 500: Error 2010: Invalid slippage"), true);
    assert.equal(isAftermathSlippageError("HTTP 500: insufficient balance"), false);
  });
});
