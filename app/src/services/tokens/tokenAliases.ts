/**
 * Shared token alias groups. Aliases are matching candidates only — resolution still
 * requires the active wallet balance (or Navi position) to confirm ownership.
 */
export type TokenAliasGroup = {
  /** Stable lowercase key */
  key: string;
  /** Preferred display symbol */
  canonicalSymbol: string;
  aliases: readonly string[];
};

export const TOKEN_ALIAS_GROUPS: readonly TokenAliasGroup[] = [
  {
    key: "usdc",
    canonicalSymbol: "USDC",
    aliases: ["usdc", "nusdc", "usd coin", "usd-coin", "native usdc"],
  },
  {
    key: "sui",
    canonicalSymbol: "SUI",
    aliases: ["sui"],
  },
  {
    key: "deep",
    canonicalSymbol: "DEEP",
    aliases: ["deep", "deepbook"],
  },
  {
    key: "wal",
    canonicalSymbol: "WAL",
    aliases: ["wal", "walrus"],
  },
  {
    key: "usdt",
    canonicalSymbol: "USDT",
    aliases: ["usdt", "tether"],
  },
  {
    key: "weth",
    canonicalSymbol: "WETH",
    aliases: ["weth", "wrapped eth", "wrapped ether"],
  },
] as const;

/** Trim and lowercase for alias / symbol comparisons. */
export function normalizeTokenInput(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function aliasLookupKey(alias: string): string {
  return normalizeTokenInput(alias);
}

const aliasToGroup = new Map<string, TokenAliasGroup>();
for (const group of TOKEN_ALIAS_GROUPS) {
  for (const alias of group.aliases) {
    aliasToGroup.set(aliasLookupKey(alias), group);
  }
  aliasToGroup.set(aliasLookupKey(group.canonicalSymbol), group);
}

/** Resolve user text to an alias group, if any. */
export function findTokenAliasGroup(input: string): TokenAliasGroup | null {
  const key = aliasLookupKey(input);
  if (!key) return null;
  return aliasToGroup.get(key) ?? null;
}

/** All normalized alias strings in the same group as `input` (includes canonical symbol). */
export function aliasesInGroup(input: string): string[] {
  const group = findTokenAliasGroup(input);
  if (!group) return [normalizeTokenInput(input)].filter(Boolean);
  const out = new Set<string>();
  out.add(normalizeTokenInput(group.canonicalSymbol));
  for (const a of group.aliases) {
    out.add(aliasLookupKey(a));
  }
  return [...out];
}

/** Map common phrases to a config symbol (uppercase). Kept for registry / trigger compatibility. */
export function expandUserTokenAlias(input: string): string {
  const t = input.trim();
  if (!t) return t;
  const group = findTokenAliasGroup(t);
  return group?.canonicalSymbol ?? t;
}

/** True when two token labels belong to the same alias group or match case-insensitively. */
export function tokenLabelsMatch(a: string, b: string): boolean {
  const na = normalizeTokenInput(a);
  const nb = normalizeTokenInput(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ga = findTokenAliasGroup(a);
  const gb = findTokenAliasGroup(b);
  if (ga && gb) return ga.key === gb.key;
  return na === nb;
}
