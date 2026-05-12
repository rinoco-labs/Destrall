export const SUI_COIN_TYPE = 784;

export function suiDerivationPath(accountIndex: number): string {
  return `m/44'/${SUI_COIN_TYPE}'/${accountIndex}'/0'/0'`;
}
