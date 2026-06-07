import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { SuiChainEnvironment } from "../../../../config/chains/sui";
import type { ChainActivityItem, ChainActivityPage } from "../../../../types/blockchain";
import { SuiTokenMetadataService } from "./sui-token-metadata.service";
import { getTransactionExplorerUrl } from "./sui-explorer.service";
import { formatTokenAmount } from "../../../../shared/tokens/amounts";

function ownerToAddress(owner: unknown): string | null {
  if (owner && typeof owner === "object" && "AddressOwner" in owner) {
    const v = (owner as { AddressOwner?: string }).AddressOwner;
    return typeof v === "string" ? v : null;
  }
  return null;
}

export async function fetchSuiActivityPage(params: {
  client: SuiJsonRpcClient;
  metadata: SuiTokenMetadataService;
  address: string;
  environment: SuiChainEnvironment;
  cursor?: string | null;
  limit?: number;
}): Promise<ChainActivityPage> {
  const limit = params.limit ?? 25;
  const digests = new Set<string>();
  const collected: ChainActivityItem[] = [];

  const query = (filter: { FromAddress: string } | { ToAddress: string }) =>
    params.client.queryTransactionBlocks({
      filter,
      order: "descending",
      cursor: params.cursor ?? undefined,
      limit,
      options: {
        showEffects: true,
        showBalanceChanges: true,
        showInput: true,
      },
    });

  const fromRes = await query({ FromAddress: params.address });
  const toRes = await query({ ToAddress: params.address });

  const mergeBlocks = fromRes.data.concat(
    toRes.data.filter((b) => !fromRes.data.some((x) => x.digest === b.digest)),
  );

  for (const block of mergeBlocks) {
    if (digests.has(block.digest)) continue;
    digests.add(block.digest);

    const digest = block.digest;
    const ts = block.timestampMs ? Number(block.timestampMs) : null;
    const status =
      block.effects?.status?.status === "success"
        ? "success"
        : block.effects?.status?.status === "failure"
          ? "failed"
          : "unknown";

    const txSender = block.transaction?.data?.sender ?? null;
    const changes = block.balanceChanges ?? [];
    const mine = changes.filter((c) => ownerToAddress(c.owner) === params.address);

    if (mine.length === 0) {
      collected.push({
        digest,
        timestamp: ts,
        type: "transaction",
        status,
        amount: null,
        symbol: null,
        sender: txSender,
        recipient: null,
        explorerUrl: getTransactionExplorerUrl(params.environment, digest),
      });
      continue;
    }

    let primary = mine[0];
    let maxAbs = 0n;
    for (const c of mine) {
      const a = BigInt(c.amount);
      const abs = a < 0n ? -a : a;
      if (abs >= maxAbs) {
        maxAbs = abs;
        primary = c;
      }
    }

    const amount = BigInt(primary.amount);
    const meta = await params.metadata.getCoinMetadata(primary.coinType);
    const abs = amount < 0n ? -amount : amount;
    const formatted = formatTokenAmount(abs, meta.decimals);
    const simplifiedType = amount > 0n ? "receive" : amount < 0n ? "send" : "other";

    const otherParty = (() => {
      if (simplifiedType === "receive") {
        return txSender;
      }
      const gainers = changes.filter((c) => {
        const o = ownerToAddress(c.owner);
        return o && o !== params.address && BigInt(c.amount) > 0n;
      });
      const first = gainers[0];
      return first ? ownerToAddress(first.owner) : txSender;
    })();

    collected.push({
      digest,
      timestamp: ts,
      type: simplifiedType,
      status,
      amount: formatted,
      symbol: meta.symbol,
      sender: simplifiedType === "receive" ? otherParty : params.address,
      recipient: simplifiedType === "send" ? otherParty : params.address,
      explorerUrl: getTransactionExplorerUrl(params.environment, digest),
    });
  }

  collected.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

  const hasNext = fromRes.hasNextPage || toRes.hasNextPage;
  const nextCursor = hasNext ? fromRes.nextCursor ?? toRes.nextCursor ?? null : null;

  return { items: collected.slice(0, limit), nextCursor };
}
