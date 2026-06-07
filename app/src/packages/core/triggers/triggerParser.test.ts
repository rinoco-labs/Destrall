import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTriggerFromText } from "./triggerParser.ts";
import { parseScheduledTriggerFromText } from "./scheduledTriggerParser.ts";

const TEST_TZ = "UTC";

describe("parseTriggerFromText — price triggers", () => {
  it("parses when sui is at 0.8 usd sell 1 sui", () => {
    const r = parseTriggerFromText("when sui is at 0.8 usd sell 1 sui");
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.draft.type, "price");
    assert.equal((r.draft.condition as { asset: string }).asset, "SUI");
    assert.equal(r.draft.action.type, "swap");
    if (r.draft.action.type === "swap") {
      assert.equal(r.draft.action.fromToken, "SUI");
      assert.equal(r.draft.action.amount, "1");
      assert.equal(r.draft.action.toToken, "USDC");
    }
  });

  it("parses when sui drops to 0.69 usd buy 10 usdc worth of sui", () => {
    const r = parseTriggerFromText("when sui drops to 0.69 usd buy 10 usdc worth of sui");
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.draft.type, "price");
    const cond = r.draft.condition as { operator: string; priceUsd: string };
    assert.equal(cond.operator, "below");
    assert.equal(cond.priceUsd, "0.69");
    if (r.draft.action.type === "swap") {
      assert.equal(r.draft.action.fromToken, "USDC");
      assert.equal(r.draft.action.toToken, "SUI");
      assert.equal(r.draft.action.amount, "10");
    }
  });

  it("parses when sui goes above 5 usd sell 10 sui", () => {
    const r = parseTriggerFromText("when sui goes above 5 usd sell 10 sui");
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const cond = r.draft.condition as { operator: string };
    assert.equal(cond.operator, "above");
    if (r.draft.action.type === "swap") {
      assert.equal(r.draft.action.amount, "10");
      assert.equal(r.draft.action.fromToken, "SUI");
    }
  });

  it("parses sell 1 sui if sui reaches $2", () => {
    const r = parseTriggerFromText("sell 1 sui if sui reaches $2");
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const cond = r.draft.condition as { operator: string; priceUsd: string };
    assert.equal(cond.operator, "above");
    assert.equal(cond.priceUsd, "2");
  });

  it("parses buy 10 usdc worth of sui when sui is below 0.8", () => {
    const r = parseTriggerFromText("buy 10 usdc worth of sui when sui is below 0.8");
    assert.equal(r.ok, true);
    if (!r.ok) return;
    if (r.draft.action.type === "swap") {
      assert.equal(r.draft.action.fromToken, "USDC");
      assert.equal(r.draft.action.toToken, "SUI");
      assert.equal(r.draft.action.amount, "10");
    }
  });
});

describe("parseScheduledTriggerFromText — time triggers", () => {
  it("parses sell 1 sui at 3:10 pm", () => {
    const r = parseScheduledTriggerFromText("sell 1 sui at 3:10 pm", TEST_TZ);
    assert.ok(r);
    assert.equal(r!.ok, true);
    if (!r || !r.ok) return;
    assert.equal(r.draft.type, "time");
    if (r.draft.action.type === "swap") {
      assert.equal(r.draft.action.fromToken, "SUI");
      assert.equal(r.draft.action.amount, "1");
      assert.equal(r.draft.action.toToken, "USDC");
    }
    assert.ok(r.draft.scheduleDisplay);
  });

  it("parses swap 10 usdc to sui tomorrow at 9am", () => {
    const r = parseScheduledTriggerFromText("swap 10 usdc to sui tomorrow at 9am", TEST_TZ);
    assert.ok(r);
    assert.equal(r!.ok, true);
    if (!r || !r.ok) return;
    assert.equal(r.draft.type, "time");
    if (r.draft.action.type === "swap") {
      assert.equal(r.draft.action.fromToken, "USDC");
      assert.equal(r.draft.action.toToken, "SUI");
      assert.equal(r.draft.action.amount, "10");
    }
  });

  it("parses deposit 20 usdc into yield every day at 10am", () => {
    const r = parseScheduledTriggerFromText("deposit 20 usdc into yield every day at 10am", TEST_TZ);
    assert.ok(r);
    assert.equal(r!.ok, true);
    if (!r || !r.ok) return;
    assert.equal(r.draft.type, "yield");
    if (r.draft.action.type === "yield_deposit") {
      assert.equal(r.draft.action.asset, "USDC");
      assert.equal(r.draft.action.amount, "20");
    }
    assert.equal(r.draft.schedule?.kind, "daily");
  });

  it("parses withdraw my usdc from navi every Friday", () => {
    const r = parseScheduledTriggerFromText("withdraw my usdc from navi every Friday", TEST_TZ);
    assert.ok(r);
    assert.equal(r!.ok, true);
    if (!r || !r.ok) return;
    assert.equal(r.draft.type, "yield");
    if (r.draft.action.type === "yield_withdraw") {
      assert.equal(r.draft.action.asset, "USDC");
      assert.equal(r.draft.action.amountKind, "all");
    }
    assert.equal(r.draft.schedule?.kind, "weekly");
  });
});

describe("parseTriggerFromText — clarification required", () => {
  it("requires clarification for sell sui when it goes up", () => {
    const r = parseTriggerFromText("sell sui when it goes up");
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.ok(r.missing.some((m) => /price|amount/i.test(m)));
  });

  it("requires clarification for buy sui when below 0.8 without amount", () => {
    const r = parseTriggerFromText("buy sui when below 0.8");
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.ok(r.missing.length > 0);
  });

  it("requires clarification for when sui is at 0.8 sell without amount", () => {
    const r = parseTriggerFromText("when sui is at 0.8 sell");
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.ok(r.missing.some((m) => /amount/i.test(m)));
  });
});
