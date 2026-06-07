import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatTextWithWalletAddresses,
  formatWalletAddress,
  looksLikeWalletAddress,
  splitTextByWalletAddresses,
} from "./formatWalletAddress.ts";

const FULL_SUI =
  "0xb99bd8abf043674a38643f18ecbed5325a480a0001f1e62652e4";

describe("formatWalletAddress", () => {
  it("shortens a full Sui address", () => {
    assert.equal(formatWalletAddress(FULL_SUI), "0xb99bd8...2652e4");
  });

  it("leaves already-short text unchanged", () => {
    assert.equal(formatWalletAddress("0xb99bd8"), "0xb99bd8");
    assert.equal(formatWalletAddress("hello"), "hello");
  });

  it("does not modify normal text", () => {
    assert.equal(formatWalletAddress("send 5 usdc"), "send 5 usdc");
    assert.equal(looksLikeWalletAddress("send 5 usdc"), false);
  });

  it("preserves the 0x prefix", () => {
    const out = formatWalletAddress(FULL_SUI);
    assert.ok(out.startsWith("0x"));
  });

  it("respects custom start/end options", () => {
    assert.equal(
      formatWalletAddress(FULL_SUI, { start: 6, end: 4 }),
      "0xb99b...52e4",
    );
  });
});

describe("formatTextWithWalletAddresses", () => {
  it("shortens only the address inside a sentence", () => {
    const input = `send 5 usdc to ${FULL_SUI}`;
    assert.equal(
      formatTextWithWalletAddresses(input),
      "send 5 usdc to 0xb99bd8...2652e4",
    );
  });

  it("shortens multiple addresses in one message", () => {
    const other = "0x" + "c".repeat(64);
    const input = `from ${FULL_SUI} to ${other}`;
    const out = formatTextWithWalletAddresses(input);
    assert.match(out, /0xb99bd8\.\.\.2652e4/);
    assert.match(out, /0xcccccc\.\.\.cccccc/);
  });

  it("leaves messages without addresses unchanged", () => {
    const input = "swap half my sui for usdc";
    assert.equal(formatTextWithWalletAddresses(input), input);
  });
});

describe("splitTextByWalletAddresses", () => {
  it("keeps the full original address value separate from display", () => {
    const input = `send to ${FULL_SUI}`;
    const segments = splitTextByWalletAddresses(input);
    const addr = segments.find((s) => s.type === "address");
    assert.ok(addr && addr.type === "address");
    assert.equal(addr.value, FULL_SUI);
    assert.equal(addr.display, "0xb99bd8...2652e4");
    assert.notEqual(addr.value, addr.display);
  });
});
