import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildNaviDepositProposalCard,
  buildNaviWithdrawProposalCard,
} from "../packages/core/yield/navi/navi-proposal-builder.ts";

describe("Navi proposal cards", () => {
  it("deposit proposal card includes wallet balance and yield/savings phrase", () => {
    const card = buildNaviDepositProposalCard({
      assetSymbol: "USDC",
      amountDisplay: "10",
      networkLabel: "Mainnet",
      apyPct: 4.5,
      gasBudgetFormatted: "0.01",
      riskLabel: "Low",
      walletBalanceDisplay: "25.4",
      decimals: 6,
      userPhrase: "yield / savings / Navi",
    });
    assert.equal(card.title, "Deposit into Navi");
    assert.ok(card.details.some((d) => d.k === "Wallet balance" && d.v.includes("25.4")));
    assert.ok(card.details.some((d) => d.k === "Requested as"));
    assert.ok(card.note?.includes("indicative"));
  });

  it("withdraw proposal card includes supplied balance", () => {
    const card = buildNaviWithdrawProposalCard({
      assetSymbol: "USDC",
      amountDisplay: "5",
      networkLabel: "Mainnet",
      apyPct: 4.5,
      gasBudgetFormatted: "0.01",
      suppliedBalanceDisplay: "12.0",
      userPhrase: "yield / savings / Navi",
    });
    assert.equal(card.title, "Withdraw from Navi");
    assert.ok(card.details.some((d) => d.k === "Supplied balance" && d.v.includes("12.0")));
  });
});
