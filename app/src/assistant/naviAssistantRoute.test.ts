import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveNaviAssistantRoute } from "./naviAssistantRoute.ts";
import {
  GET_YIELD_POSITIONS_ACTION_NAME,
  LIST_YIELD_POOLS_ACTION_NAME,
  PREPARE_YIELD_DEPOSIT_ACTION_NAME,
  PREPARE_YIELD_WITHDRAW_ACTION_NAME,
} from "./assistantFunctionSchemas.ts";
import { isYieldPositionsQuestion } from "./yieldPositionIntent.ts";
import { isNaviAvailablePoolsQuestion } from "./naviIntentVocabulary.ts";

describe("resolveNaviAssistantRoute", () => {
  it("routes what are my savings to get_yield_positions", () => {
    const routed = resolveNaviAssistantRoute("what are my savings");
    assert.equal(routed?.namespacedName, GET_YIELD_POSITIONS_ACTION_NAME);
    assert.equal(routed?.category, "positions");
  });

  it("routes savings positions to get_yield_positions", () => {
    const routed = resolveNaviAssistantRoute("What are my savings positions?");
    assert.ok(routed);
    assert.equal(routed.namespacedName, GET_YIELD_POSITIONS_ACTION_NAME);
    assert.equal(routed.category, "positions");
  });

  it("routes yield positions to get_yield_positions", () => {
    const routed = resolveNaviAssistantRoute("What are my yield positions?");
    assert.equal(routed?.namespacedName, GET_YIELD_POSITIONS_ACTION_NAME);
    assert.equal(routed?.category, "positions");
  });

  it("routes available yield to list_yield_pools", () => {
    const routed = resolveNaviAssistantRoute("What yield is available?");
    assert.equal(routed?.namespacedName, LIST_YIELD_POOLS_ACTION_NAME);
    assert.equal(routed?.category, "pools");
  });

  it("routes available savings to list_yield_pools", () => {
    const routed = resolveNaviAssistantRoute("Show available savings pools");
    assert.equal(routed?.namespacedName, LIST_YIELD_POOLS_ACTION_NAME);
    assert.equal(routed?.category, "pools");
  });

  it("routes deposit USDC into yield to prepare_yield_deposit", () => {
    const routed = resolveNaviAssistantRoute("Deposit 10 USDC into yield");
    assert.equal(routed?.namespacedName, PREPARE_YIELD_DEPOSIT_ACTION_NAME);
    assert.equal(routed?.input.asset, "USDC");
    assert.equal(routed?.input.amount, "10");
    assert.equal(routed?.category, "deposit");
  });

  it("routes deposit SUI into savings to prepare_yield_deposit", () => {
    const routed = resolveNaviAssistantRoute("Put 5 SUI into savings");
    assert.equal(routed?.namespacedName, PREPARE_YIELD_DEPOSIT_ACTION_NAME);
    assert.equal(routed?.input.asset, "SUI");
    assert.equal(routed?.category, "deposit");
  });

  it("routes withdraw USDC from savings to prepare_yield_withdraw", () => {
    const routed = resolveNaviAssistantRoute("Withdraw 10 USDC from savings");
    assert.equal(routed?.namespacedName, PREPARE_YIELD_WITHDRAW_ACTION_NAME);
    assert.equal(routed?.input.asset, "USDC");
    assert.equal(routed?.input.amountKind, "absolute");
    assert.equal(routed?.category, "withdraw");
  });

  it("still routes explicit Navi deposit commands", () => {
    const routed = resolveNaviAssistantRoute("Deposit 20 usdc into Navi");
    assert.equal(routed?.namespacedName, PREPARE_YIELD_DEPOSIT_ACTION_NAME);
  });

  it("still routes explicit Navi withdraw commands", () => {
    const routed = resolveNaviAssistantRoute("Take my SUI out of Navi");
    assert.equal(routed?.namespacedName, PREPARE_YIELD_WITHDRAW_ACTION_NAME);
    assert.equal(routed?.input.amountKind, "all");
  });

  it("routes percentage deposit into yield", () => {
    const routed = resolveNaviAssistantRoute("Move 30% of my USDC into yield");
    assert.equal(routed?.namespacedName, PREPARE_YIELD_DEPOSIT_ACTION_NAME);
    assert.equal(routed?.input.amountKind, "percentage");
  });
});

describe("isYieldPositionsQuestion", () => {
  it("matches savings and yield position phrasing", () => {
    assert.equal(isYieldPositionsQuestion("what are my savings positions?"), true);
    assert.equal(isYieldPositionsQuestion("show my current savings"), true);
    assert.equal(isYieldPositionsQuestion("what yield do i have open?"), true);
    assert.equal(isYieldPositionsQuestion("show my open navi positions"), true);
  });

  it("matches bare savings and yield questions", () => {
    assert.equal(isYieldPositionsQuestion("what are my savings"), true);
    assert.equal(isYieldPositionsQuestion("what are my savings?"), true);
    assert.equal(isYieldPositionsQuestion("what is my yield"), true);
    assert.equal(isYieldPositionsQuestion("show me my savings"), true);
    assert.equal(isYieldPositionsQuestion("see my yield"), true);
  });

  it("excludes available pool questions", () => {
    assert.equal(isYieldPositionsQuestion("what yield is available?"), false);
    assert.equal(isYieldPositionsQuestion("show available savings pools"), false);
  });

  it("excludes deposit and withdraw commands", () => {
    assert.equal(isYieldPositionsQuestion("deposit 10 usdc into yield"), false);
    assert.equal(isYieldPositionsQuestion("withdraw usdc from savings"), false);
  });
});

describe("isNaviAvailablePoolsQuestion", () => {
  it("matches earn-yield phrasing", () => {
    assert.equal(isNaviAvailablePoolsQuestion("where can i earn yield?"), true);
    assert.equal(isNaviAvailablePoolsQuestion("show apys"), true);
  });

  it("does not match position questions", () => {
    assert.equal(isNaviAvailablePoolsQuestion("what are my yield positions?"), false);
  });
});
