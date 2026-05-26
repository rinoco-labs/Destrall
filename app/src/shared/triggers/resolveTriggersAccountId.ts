/** Resolves the wallet account id used for trigger list and mutations. */
export function resolveTriggersAccountId(
  activeAccountId: string | null,
  accounts: readonly { id: string }[],
): string | null {
  if (activeAccountId) {
    return accounts.find((account) => account.id === activeAccountId)?.id ?? null;
  }
  return accounts[0]?.id ?? null;
}
