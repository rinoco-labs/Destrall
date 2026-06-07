import type { TokenBalanceView } from "../../../../types/blockchain";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { formatTokenAmount } from "../../../../shared/tokens/amounts";
import { CoinMetadataError, SuiTokenMetadataService } from "./sui-token-metadata.service";

function shortenCoinType(coinType: string): string {
  const t = coinType.trim();
  if (t.length <= 24) return t;
  return `${t.slice(0, 14)}…${t.slice(-10)}`;
}

export async function fetchSuiBalancesForAddress(
  client: SuiJsonRpcClient,
  metadata: SuiTokenMetadataService,
  address: string,
): Promise<TokenBalanceView[]> {
  const rows = await client.getAllBalances({ owner: address });
  const out: TokenBalanceView[] = [];

  for (const row of rows) {
    try {
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
    } catch (e) {
      if (e instanceof CoinMetadataError) {
        console.warn("[sui] balance row omitted — decimals unresolved", {
          coinType: shortenCoinType(row.coinType),
        });
        continue;
      }
      throw e;
    }
  }

  out.sort((a, b) => {
    if (a.coinType.endsWith("::sui::SUI")) return -1;
    if (b.coinType.endsWith("::sui::SUI")) return 1;
    return a.symbol.localeCompare(b.symbol);
  });

  return out;
}
