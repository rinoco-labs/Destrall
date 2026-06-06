import type { TokenBalanceView } from "../../../../types/blockchain";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { formatTokenAmount } from "../../../../shared/tokens/amounts";
import { SuiTokenMetadataService } from "./sui-token-metadata.service";

export { formatTokenAmount } from "../../../../shared/tokens/amounts";

export async function fetchSuiBalancesForAddress(
  client: SuiJsonRpcClient,
  metadata: SuiTokenMetadataService,
  address: string,
): Promise<TokenBalanceView[]> {
  const rows = await client.getAllBalances({ owner: address });
  const out: TokenBalanceView[] = [];

  for (const row of rows) {
    const meta = await metadata.getCoinMetadata(row.coinType);
    const raw = BigInt(row.totalBalance);
    out.push({
      coinType: row.coinType,
      symbol: meta.symbol,
      decimals: meta.decimals,
      balanceRaw: row.totalBalance,
      balanceFormatted: formatTokenAmount(raw, meta.decimals),
      iconUrl: meta.iconUrl ?? undefined,
    });
  }

  out.sort((a, b) => {
    if (a.coinType.endsWith("::sui::SUI")) return -1;
    if (b.coinType.endsWith("::sui::SUI")) return 1;
    return a.symbol.localeCompare(b.symbol);
  });

  return out;
}
