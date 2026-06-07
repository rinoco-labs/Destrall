import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveContactRecipient,
  resolveRecipientLabel,
  tryParseSuiAddress,
} from "./contactResolutionService.ts";

const ADDR_A = "0x" + "a".repeat(64);
const ADDR_B = "0x" + "b".repeat(64);
const ADDR_C = "0x" + "c".repeat(64);

describe("resolveContactRecipient", () => {
  it("resolves Max when user types max", () => {
    const r = resolveContactRecipient("max", [{ id: "1", name: "Max", address: ADDR_A }]);
    assert.equal(r.kind, "single");
    if (r.kind === "single") {
      assert.equal(r.contact.name, "Max");
      assert.equal(r.contact.address, ADDR_A);
    }
  });

  it("resolves max when saved contact is Max", () => {
    const r = resolveContactRecipient("max", [{ id: "1", name: "Max", address: ADDR_A }]);
    assert.equal(r.kind, "single");
  });

  it("resolves MAX when saved contact is Max", () => {
    const r = resolveContactRecipient("MAX", [{ id: "1", name: "Max", address: ADDR_A }]);
    assert.equal(r.kind, "single");
    if (r.kind === "single") assert.equal(r.contact.name, "Max");
  });

  it("resolves input with surrounding whitespace", () => {
    const r = resolveContactRecipient(" max ", [{ id: "1", name: "Max", address: ADDR_A }]);
    assert.equal(r.kind, "single");
  });

  it("bypasses contact lookup for a valid wallet address", () => {
    const r = resolveContactRecipient(ADDR_A, [{ id: "1", name: "Max", address: ADDR_B }]);
    assert.equal(r.kind, "sui_address");
    if (r.kind === "sui_address") assert.equal(r.address, ADDR_A);
  });

  it("returns none when no contact matches", () => {
    const r = resolveContactRecipient("nobody", [{ id: "1", name: "Max", address: ADDR_A }]);
    assert.equal(r.kind, "none");
  });

  it("returns ambiguous when multiple contacts share a normalized name", () => {
    const contacts = [
      { id: "1", name: "Max", address: ADDR_A },
      { id: "2", name: "max", address: ADDR_B },
      { id: "3", name: "MAX", address: ADDR_C },
    ];
    const r = resolveContactRecipient("max", contacts);
    assert.equal(r.kind, "ambiguous");
    if (r.kind === "ambiguous") assert.equal(r.matches.length, 3);
  });

  it("does not treat short names like max as wallet addresses", () => {
    assert.equal(tryParseSuiAddress("max"), null);
    assert.equal(tryParseSuiAddress("MAX"), null);
  });
});

const SEND_TO_RE = /\b(?:send|transfer)\s+([\d.,]+)\s+(\w+)\s+to\s+(.+)/i;

describe("assistant send phrasing", () => {
  it("parses send 1 SUI to max with recipient max", () => {
    const m = "send 1 SUI to max".match(SEND_TO_RE);
    assert.ok(m);
    assert.equal(m[1], "1");
    assert.equal(m[2], "SUI");
    assert.equal(m[3].trim().replace(/[.,!?;:]+$/, ""), "max");
  });

  it("parses send 1 USDC to MAX with recipient MAX", () => {
    const m = "send 1 USDC to MAX".match(SEND_TO_RE);
    assert.ok(m);
    assert.equal(m[3].trim().replace(/[.,!?;:]+$/, ""), "MAX");
  });
});

describe("resolveRecipientLabel", () => {
  it("preserves original contact display name on case-insensitive match", () => {
    const r = resolveRecipientLabel({
      recipient: "mAx",
      contacts: [{ id: "1", name: "Max", address: ADDR_A }],
    });
    assert.equal(r.kind, "single_contact");
    if (r.kind === "single_contact") {
      assert.equal(r.contact.name, "Max");
      assert.equal(r.contact.address, ADDR_A);
    }
  });

  it("returns ambiguous_contact for duplicate normalized names", () => {
    const r = resolveRecipientLabel({
      recipient: "max",
      contacts: [
        { id: "1", name: "Max", address: ADDR_A },
        { id: "2", name: "max", address: ADDR_B },
      ],
    });
    assert.equal(r.kind, "ambiguous_contact");
    if (r.kind === "ambiguous_contact") assert.equal(r.matches.length, 2);
  });

  it("uses wallet address directly and skips contact lookup", () => {
    const r = resolveRecipientLabel({
      recipient: ADDR_A,
      contacts: [{ id: "1", name: "Max", address: ADDR_B }],
    });
    assert.equal(r.kind, "sui_address");
    if (r.kind === "sui_address") assert.equal(r.address, ADDR_A);
  });

  it("resumes send with selected ambiguous contact address", () => {
    const r = resolveRecipientLabel({
      recipient: ADDR_B,
      contacts: [
        { id: "1", name: "Max", address: ADDR_A },
        { id: "2", name: "max", address: ADDR_B },
      ],
    });
    assert.equal(r.kind, "sui_address");
    if (r.kind === "sui_address") assert.equal(r.address, ADDR_B);
  });
});
