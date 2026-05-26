/** Safe log fragment — never log full account ids. */
export function shortTriggerAccountId(accountId: string): string {
  const t = accountId.trim();
  if (t.length <= 10) return t;
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}
