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

export type ContactRecipientResolution =
  | { kind: "sui_address"; address: string }
  | { kind: "single"; contact: ContactLike; normalizedQuery: string }
  | { kind: "ambiguous"; matches: ContactLike[]; normalizedQuery: string }
  | { kind: "none"; normalizedQuery: string };

export type ResolveContactRecipientOptions = {
  /** When true (default), allow substring / word partial matches consistent with legacy behavior. */
  allowPartialMatch?: boolean;
  /** Context label for debug logs (e.g. assistant-send). */
  logContext?: string;
};

/** Trim and normalize a recipient name for case-insensitive comparison. */
export function normalizeRecipientInput(s: string): string {
  return normalizeNameKey(s);
}

function normalizeNameKey(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function trimRecipientInput(recipient: string): string {
  return recipient.trim().replace(/[.,!?;:]+$/, "");
}

/** Canonical Sui address payload: 32 bytes → 64 hex digits after `0x`. */
const SUI_ADDRESS_HEX_LEN = 64;

/**
 * Parse a user-supplied fragment as a Sui address only if it is a full 32-byte address.
 * `normalizeSuiAddress` alone is unsafe: e.g. normalizeSuiAddress("max") or "0xabc" zero-pads
 * to a value `isValidSuiAddress` accepts — that would skip contact / SuiNS resolution.
 */
export function tryParseSuiAddress(fragment: string): string | null {
  const t = fragment.trim();
  if (!t) return null;
  const hex = t.startsWith("0x") || t.startsWith("0X") ? t.slice(2) : t;
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length !== SUI_ADDRESS_HEX_LEN) {
    return null;
  }
  try {
    const normalized = normalizeSuiAddress(t);
    return isValidSuiAddress(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

export function shortenAddressForLog(address: string): string {
  const t = address.trim();
  if (t.length <= 16) return t;
  return `${t.slice(0, 10)}…${t.slice(-6)}`;
}

export function logContactResolutionDebug(params: {
  context?: string;
  rawInput: string;
  normalizedInput: string;
  matchCount: number;
  resultKind: ContactRecipientResolution["kind"] | RecipientResolution["kind"];
  selectedContactName?: string;
  selectedAddress?: string;
}) {
  const prefix = params.context ? `[contacts:${params.context}]` : "[contacts]";
  console.debug(prefix, "recipient resolution", {
    raw: params.rawInput,
    normalized: params.normalizedInput,
    matches: params.matchCount,
    result: params.resultKind,
    ...(params.selectedContactName ? { contact: params.selectedContactName } : {}),
    ...(params.selectedAddress ? { address: shortenAddressForLog(params.selectedAddress) } : {}),
  });
}

/**
 * Resolve a recipient string against saved contacts.
 * Priority: valid wallet address → exact case-insensitive name → optional partial name match.
 */
export function resolveContactRecipient(
  input: string,
  contacts: ContactLike[],
  options?: ResolveContactRecipientOptions,
): ContactRecipientResolution {
  const raw = trimRecipientInput(input);
  if (!raw) {
    const res: ContactRecipientResolution = { kind: "none", normalizedQuery: "" };
    logContactResolutionDebug({
      context: options?.logContext,
      rawInput: input,
      normalizedInput: "",
      matchCount: 0,
      resultKind: res.kind,
    });
    return res;
  }

  const asAddr = tryParseSuiAddress(raw);
  if (asAddr) {
    const res: ContactRecipientResolution = { kind: "sui_address", address: asAddr };
    logContactResolutionDebug({
      context: options?.logContext,
      rawInput: input,
      normalizedInput: raw,
      matchCount: 0,
      resultKind: res.kind,
      selectedAddress: asAddr,
    });
    return res;
  }

  const key = normalizeNameKey(raw);
  const exactMatches = dedupeContacts(contacts.filter((c) => normalizeNameKey(c.name) === key));

  if (exactMatches.length === 1) {
    const res: ContactRecipientResolution = {
      kind: "single",
      contact: exactMatches[0],
      normalizedQuery: key,
    };
    logContactResolutionDebug({
      context: options?.logContext,
      rawInput: input,
      normalizedInput: key,
      matchCount: 1,
      resultKind: res.kind,
      selectedContactName: exactMatches[0].name,
      selectedAddress: exactMatches[0].address,
    });
    return res;
  }

  if (exactMatches.length > 1) {
    const res: ContactRecipientResolution = {
      kind: "ambiguous",
      matches: exactMatches,
      normalizedQuery: key,
    };
    logContactResolutionDebug({
      context: options?.logContext,
      rawInput: input,
      normalizedInput: key,
      matchCount: exactMatches.length,
      resultKind: res.kind,
    });
    return res;
  }

  if (options?.allowPartialMatch !== false) {
    const partialContacts = contacts.filter((c) => {
      const nk = normalizeNameKey(c.name);
      if (nk.includes(key)) return true;
      const words = key.split(/\s+/).filter(Boolean);
      return words.length > 0 && words.every((w) => nk.includes(w));
    });
    const uniqPartial = dedupeContacts(partialContacts);
    if (uniqPartial.length === 1) {
      const res: ContactRecipientResolution = {
        kind: "single",
        contact: uniqPartial[0],
        normalizedQuery: key,
      };
      logContactResolutionDebug({
        context: options?.logContext,
        rawInput: input,
        normalizedInput: key,
        matchCount: 1,
        resultKind: res.kind,
        selectedContactName: uniqPartial[0].name,
        selectedAddress: uniqPartial[0].address,
      });
      return res;
    }
    if (uniqPartial.length > 1) {
      const res: ContactRecipientResolution = {
        kind: "ambiguous",
        matches: uniqPartial,
        normalizedQuery: key,
      };
      logContactResolutionDebug({
        context: options?.logContext,
        rawInput: input,
        normalizedInput: key,
        matchCount: uniqPartial.length,
        resultKind: res.kind,
      });
      return res;
    }
  }

  const res: ContactRecipientResolution = { kind: "none", normalizedQuery: key };
  logContactResolutionDebug({
    context: options?.logContext,
    rawInput: input,
    normalizedInput: key,
    matchCount: 0,
    resultKind: res.kind,
  });
  return res;
}

/**
 * Resolve a free-text recipient against contacts and optional other wallet accounts.
 * Order: explicit address → exact contact name → exact account name → partial contact → partial account → address substring on contacts.
 */
export function resolveRecipientLabel(params: {
  recipient: string;
  contacts: ContactLike[];
  otherAccounts?: WalletAccountLike[];
  logContext?: string;
}): RecipientResolution {
  const raw = trimRecipientInput(params.recipient);
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

  const contactRes = resolveContactRecipient(raw, params.contacts, {
    allowPartialMatch: true,
    logContext: params.logContext,
  });

  if (contactRes.kind === "single") {
    return { kind: "single_contact", contact: contactRes.contact };
  }
  if (contactRes.kind === "ambiguous") {
    return { kind: "ambiguous_contact", matches: contactRes.matches, query: raw };
  }

  if (params.otherAccounts?.length) {
    const exactAcc = params.otherAccounts.find((a) => normalizeNameKey(a.name) === contactRes.normalizedQuery);
    if (exactAcc) {
      const addr = tryParseSuiAddress(exactAcc.address);
      return addr ? { kind: "sui_address", address: addr } : { kind: "none", query: raw };
    }
  }

  if (params.otherAccounts?.length) {
    const accRes = resolveAmongAccounts(raw, params.otherAccounts);
    if (accRes.kind === "sui_address" || accRes.kind === "ambiguous_account") {
      return accRes;
    }
  }

  const addressNeedle = raw.toLowerCase();
  const addrHits = params.contacts.filter((c) => c.address.toLowerCase().includes(addressNeedle));
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

  const exactMatches = accounts.filter((a) => normalizeNameKey(a.name) === hint);
  if (exactMatches.length === 1) {
    const addr = tryParseSuiAddress(exactMatches[0].address);
    return addr ? { kind: "sui_address", address: addr } : { kind: "none", query: nameHint };
  }
  if (exactMatches.length > 1) {
    return { kind: "ambiguous_account", matches: exactMatches, query: nameHint };
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
