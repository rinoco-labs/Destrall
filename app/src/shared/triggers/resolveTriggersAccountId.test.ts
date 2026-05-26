import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveTriggersAccountId } from "./resolveTriggersAccountId.ts";

describe("resolveTriggersAccountId", () => {
  it("uses active account when set", () => {
    assert.equal(
      resolveTriggersAccountId("acc-b", [
        { id: "acc-a" },
        { id: "acc-b" },
      ]),
      "acc-b",
    );
  });

  it("falls back to first account when active id is null", () => {
    assert.equal(resolveTriggersAccountId(null, [{ id: "acc-a" }]), "acc-a");
  });

  it("returns null when no accounts", () => {
    assert.equal(resolveTriggersAccountId(null, []), null);
  });

  it("does not fall back when active id is unknown (account isolation)", () => {
    assert.equal(resolveTriggersAccountId("acc-missing", [{ id: "acc-a" }]), null);
  });
});
