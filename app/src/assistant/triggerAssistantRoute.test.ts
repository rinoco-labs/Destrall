import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasTriggerCreateIntent } from "./triggerIntentVocabulary.ts";
import { CREATE_TRIGGER_ACTION_NAME } from "./assistantFunctionSchemas.ts";

describe("hasTriggerCreateIntent", () => {
  it("detects price sell triggers", () => {
    assert.equal(hasTriggerCreateIntent("when sui is at 0.8 usd sell 1 sui"), true);
    assert.equal(hasTriggerCreateIntent("when sui drops to 0.69 usd buy 10 usdc worth of sui"), true);
    assert.equal(hasTriggerCreateIntent("when sui goes above 5 usd sell 10 sui"), true);
    assert.equal(hasTriggerCreateIntent("buy 10 usdc worth of sui when sui is below 0.8"), true);
    assert.equal(hasTriggerCreateIntent("sell 1 sui if sui reaches $2"), true);
  });

  it("detects time sell triggers", () => {
    assert.equal(hasTriggerCreateIntent("sell 1 sui at 3:10 pm"), true);
    assert.equal(hasTriggerCreateIntent("swap 10 usdc to sui tomorrow at 9am"), true);
  });

  it("detects recurring yield triggers", () => {
    assert.equal(hasTriggerCreateIntent("deposit 20 usdc into yield every day at 10am"), true);
    assert.equal(hasTriggerCreateIntent("withdraw my usdc from navi every Friday"), true);
  });

  it("does not treat trigger help as create intent", () => {
    assert.equal(hasTriggerCreateIntent("how do triggers work"), false);
  });

  it("does not treat plain swap as trigger intent", () => {
    assert.equal(hasTriggerCreateIntent("swap 1 sui to usdc"), false);
  });
});

describe("trigger routing contract", () => {
  it("maps clear trigger commands to create_trigger action name", () => {
    const samples = [
      "when sui is at 0.8 usd sell 1 sui",
      "sell 1 sui at 3:10 pm",
      "when sui drops to 0.69 usd buy 10 usdc worth of sui",
      "sell sui when it goes up",
    ];
    for (const text of samples) {
      assert.equal(hasTriggerCreateIntent(text), true, text);
      assert.equal(CREATE_TRIGGER_ACTION_NAME, "core.triggers.create_trigger");
    }
  });
});
