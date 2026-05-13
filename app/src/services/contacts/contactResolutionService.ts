import { isValidSuiAddress, normalizeSuiAddress } from "@mysten/sui/utils";

export type ContactLike = { id: string; name: string; address: string };

export type WalletAccountLike = { id: string; name: string; address: string };

const OTHER_WALLET_MARKER = /^__OTHER_ACCOUNT__(?::(.*))?$/i;

export function parseOtherAccountRecipient(recipient: string): { kind: "other_account"; nameHint: string } | null {
  const t = recipient.trim();
  const m = t.match(OTHER_WALLET_MARKER);
  if (!m) return null;
  return { kind: "other_account", nameHint: (m[1] ?? "").trim() };
}

export type RecipientResolution =
  | { kind: "sui_address"; address: string }
  | { kind: "single_contact"; contact: ContactLike }
  | { kind: "ambiguous_contact"; matches: ContactLike[]; query: string }
  | { kind: "ambiguous_account"; matches: WalletAccountLike[]; query: string }
  | { kind: "none"; query: string };

function normalizeNameKey(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Parse a user-supplied fragment as a Sui address only if it is actually valid.
 * `normalizeSuiAddress` alone is unsafe: e.g. normalizeSuiAddress("max") returns a
 * zero-padded string that is not a real address but does not throw — that would skip
 * contact-name resolution for short names like "max".
 */
export function tryParseSuiAddress(fragment: string): string | null {
  const t = fragment.trim();
  if (!t) return null;
  try {
    const normalized = normalizeSuiAddress(t);
    return isValidSuiAddress(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a free-text recipient against contacts and optional other wallet accounts.
 * Order: explicit address → exact contact name → exact account name → partial contact → partial account → address substring on contacts.
 */
export function resolveRecipientLabel(params: {
  recipient: string;
  contacts: ContactLike[];
  otherAccounts?: WalletAccountLike[];
}): RecipientResolution {
  const raw = params.recipient.trim().replace(/[.,!?;:]+$/, "");
  if (!raw) {
    return { kind: "none", query: params.recipient };
  }

  const asAddr = tryParseSuiAddress(raw);
  if (asAddr) {
    return { kind: "sui_address", address: asAddr };
  }

  const other = parseOtherAccountRecipient(raw);
  if (other && params.otherAccounts?.length) {
    return resolveAmongAccounts(other.nameHint, params.otherAccounts);
  }

  const contacts = params.contacts;
  const key = normalizeNameKey(raw);

  const exactContact = contacts.find((c) => normalizeNameKey(c.name) === key);
  if (exactContact) {
    return { kind: "single_contact", contact: exactContact };
  }

  if (params.otherAccounts?.length) {
    const exactAcc = params.otherAccounts.find((a) => normalizeNameKey(a.name) === key);
    if (exactAcc) {
      const addr = tryParseSuiAddress(exactAcc.address);
      return addr ? { kind: "sui_address", address: addr } : { kind: "none", query: raw };
    }
  }

  const partialContacts = contacts.filter((c) => {
    const nk = normalizeNameKey(c.name);
    if (nk.includes(key)) return true;
    const words = key.split(/\s+/).filter(Boolean);
    return words.length > 0 && words.every((w) => nk.includes(w));
  });
  const uniqPartial = dedupeContacts(partialContacts);
  if (uniqPartial.length === 1) {
    return { kind: "single_contact", contact: uniqPartial[0] };
  }
  if (uniqPartial.length > 1) {
    return { kind: "ambiguous_contact", matches: uniqPartial, query: raw };
  }

  if (params.otherAccounts?.length) {
    const accRes = resolveAmongAccounts(raw, params.otherAccounts);
    if (accRes.kind === "sui_address" || accRes.kind === "ambiguous_account") {
      return accRes;
    }
  }

  const addressNeedle = raw.toLowerCase();
  const addrHits = contacts.filter((c) => c.address.toLowerCase().includes(addressNeedle));
  const uniqAddr = dedupeContacts(addrHits);
  if (uniqAddr.length === 1) {
    return { kind: "single_contact", contact: uniqAddr[0] };
  }
  if (uniqAddr.length > 1) {
    return { kind: "ambiguous_contact", matches: uniqAddr, query: raw };
  }

  return { kind: "none", query: raw };
}

function dedupeContacts(items: ContactLike[]): ContactLike[] {
  const seen = new Set<string>();
  const out: ContactLike[] = [];
  for (const c of items) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

function resolveAmongAccounts(nameHint: string, accounts: WalletAccountLike[]): RecipientResolution {
  const hint = normalizeNameKey(nameHint);
  if (!hint) {
    if (accounts.length === 1) {
      const a = accounts[0];
      const addr = tryParseSuiAddress(a.address);
      return addr ? { kind: "sui_address", address: addr } : { kind: "none", query: "" };
    }
    return { kind: "ambiguous_account", matches: accounts, query: "my other wallet" };
  }

  const exact = accounts.find((a) => normalizeNameKey(a.name) === hint);
  if (exact) {
    const addr = tryParseSuiAddress(exact.address);
    return addr ? { kind: "sui_address", address: addr } : { kind: "none", query: nameHint };
  }

  const partial = accounts.filter((a) => normalizeNameKey(a.name).includes(hint));
  if (partial.length === 1) {
    const a = partial[0];
    const addr = tryParseSuiAddress(a.address);
    return addr ? { kind: "sui_address", address: addr } : { kind: "none", query: nameHint };
  }
  if (partial.length > 1) {
    return { kind: "ambiguous_account", matches: partial, query: nameHint };
  }

  return { kind: "none", query: nameHint };
}
