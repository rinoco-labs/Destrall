import { randomUUID } from "node:crypto";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { SUI_COIN_TYPE } from "../../../../config/chains/sui";
import type { SuiChainEnvironment } from "../../../../config/chains/sui";
import type {
  TransferExecuteResult,
  TransferPrepareResult,
  TransferPrepareSummary,
} from "../../../../types/blockchain";
import { deriveSuiAccountFromMnemonic } from "./sui-wallet.service";
import { walletSession } from "../../../wallet/walletSession";
import { walletService } from "../../../wallet/walletService";
import { formatTokenAmount } from "./sui-balance.service";
import { SuiTokenMetadataService } from "./sui-token-metadata.service";
import { getTransactionExplorerUrl } from "./sui-explorer.service";
import { decimalStringToRawAmount } from "../amount-utils";

type PendingTransfer = {
  expiresAt: number;
  accountId: string;
  environment: SuiChainEnvironment;
  senderAddress: string;
  recipient: string;
  coinType: string;
  amountRaw: string;
};

const pending = new Map<string, PendingTransfer>();
const TTL_MS = 5 * 60 * 1000;

function cleanupExpired() {
  const now = Date.now();
  for (const [id, p] of pending) {
    if (p.expiresAt < now) pending.delete(id);
  }
}

async function fetchAllCoinObjects(client: SuiJsonRpcClient, owner: string, coinType: string) {
  const out: { coinObjectId: string; balance: string }[] = [];
  let cursor: string | null | undefined;
  do {
    const page = await client.getCoins({ owner, coinType, cursor: cursor ?? undefined });
    out.push(...page.data.map((c) => ({ coinObjectId: c.coinObjectId, balance: c.balance })));
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);
  return out;
}

async function buildTransferTransaction(params: {
  client: SuiJsonRpcClient;
  sender: string;
  recipient: string;
  coinType: string;
  amount: bigint;
}): Promise<Transaction> {
  const tx = new Transaction();
  tx.setSender(params.sender);

  if (params.coinType === SUI_COIN_TYPE) {
    const [sendCoin] = tx.splitCoins(tx.gas, [params.amount]);
    tx.transferObjects([sendCoin], params.recipient);
    return tx;
  }

  const coins = await fetchAllCoinObjects(params.client, params.sender, params.coinType);
  if (!coins.length) {
    throw new Error("No coins available for this token.");
  }

  const sorted = [...coins].sort((a, b) => {
    const ba = BigInt(a.balance);
    const bb = BigInt(b.balance);
    if (ba === bb) return 0;
    return ba > bb ? -1 : 1;
  });

  let total = 0n;
  for (const c of sorted) {
    total += BigInt(c.balance);
  }
  if (total < params.amount) {
    throw new Error("Insufficient token balance.");
  }

  const primary = sorted[0];
  const primaryObj = tx.object(primary.coinObjectId);
  for (let i = 1; i < sorted.length; i++) {
    tx.mergeCoins(primaryObj, [tx.object(sorted[i].coinObjectId)]);
  }

  const [sendCoin] = tx.splitCoins(primaryObj, [params.amount]);
  tx.transferObjects([sendCoin], params.recipient);
  return tx;
}

async function ensureBalances(params: {
  client: SuiJsonRpcClient;
  address: string;
  coinType: string;
  amount: bigint;
}) {
  const gasHeadroom = 50_000_000n;
  const suiBal = await params.client.getBalance({ owner: params.address });
  const suiTotal = BigInt(suiBal.totalBalance);
  if (params.coinType === SUI_COIN_TYPE) {
    if (suiTotal < params.amount + gasHeadroom) {
      throw new Error("Insufficient balance for amount plus gas reserve.");
    }
    return;
  }
  if (suiTotal < gasHeadroom) {
    throw new Error("Insufficient SUI for gas.");
  }
  const coins = await fetchAllCoinObjects(params.client, params.address, params.coinType);
  let total = 0n;
  for (const c of coins) {
    total += BigInt(c.balance);
  }
  if (total < params.amount) {
    throw new Error("Insufficient token balance.");
  }
}

export class SuiTransferService {
  constructor(
    private readonly getClient: () => SuiJsonRpcClient,
    private readonly getEnvironment: () => SuiChainEnvironment,
    private readonly getMetadata: () => SuiTokenMetadataService,
  ) {}

  async prepareTransfer(params: {
    accountId: string;
    senderAddress: string;
    recipient: string;
    coinType: string;
    amountDisplay: string;
  }): Promise<TransferPrepareResult> {
    cleanupExpired();
    const client = this.getClient();
    const env = this.getEnvironment();
    const meta = this.getMetadata();
    const coinMeta = await meta.getCoinMetadata(params.coinType);
    const amountRaw = decimalStringToRawAmount(params.amountDisplay, coinMeta.decimals).toString();
    const amount = BigInt(amountRaw);

    let recipient: string;
    try {
      recipient = normalizeSuiAddress(params.recipient.trim());
    } catch {
      throw new Error("Invalid Sui address.");
    }

    if (recipient === params.senderAddress) {
      throw new Error("Cannot send to the same address.");
    }

    await ensureBalances({
      client,
      address: params.senderAddress,
      coinType: params.coinType,
      amount,
    });

    const tx = await buildTransferTransaction({
      client,
      sender: params.senderAddress,
      recipient,
      coinType: params.coinType,
      amount,
    });

    const gasPrice = await client.getReferenceGasPrice();
    const budget = BigInt(gasPrice) * 300_000n;
    const gasBudgetMist = (budget > 50_000_000n ? budget : 50_000_000n).toString();
    tx.setGasBudget(Number(gasBudgetMist));

    try {
      await tx.build({ client });
    } catch (e) {
      console.warn("[sui] transfer build failed", e instanceof Error ? e.message : e);
      throw new Error("Could not build transaction for this network.");
    }

    const transferRequestId = randomUUID();
    pending.set(transferRequestId, {
      expiresAt: Date.now() + TTL_MS,
      accountId: params.accountId,
      environment: env,
      senderAddress: params.senderAddress,
      recipient,
      coinType: params.coinType,
      amountRaw,
    });

    const summary: TransferPrepareSummary = {
      coinType: params.coinType,
      symbol: coinMeta.symbol,
      decimals: coinMeta.decimals,
      amountRaw,
      amountFormatted: formatTokenAmount(amount, coinMeta.decimals),
      recipient,
      sender: params.senderAddress,
      gasBudgetMist,
      gasBudgetFormatted: formatTokenAmount(BigInt(gasBudgetMist), 9),
    };

    return { transferRequestId, summary };
  }

  async confirmTransfer(params: { transferRequestId: string }): Promise<TransferExecuteResult> {
    cleanupExpired();
    const p = pending.get(params.transferRequestId);
    if (!p) {
      throw new Error("Transfer session expired or invalid. Please prepare again.");
    }
    pending.delete(params.transferRequestId);

    const mnemonic = walletSession.getMnemonic();
    if (!mnemonic) {
      throw new Error("Wallet is locked. Unlock to send a transaction.");
    }

    const account = walletService.getWalletAccount(p.accountId);
    if (!account) {
      throw new Error("Account not found.");
    }

    const keyMaterial = deriveSuiAccountFromMnemonic(mnemonic, account.accountIndex);
    if (keyMaterial.address !== p.senderAddress) {
      throw new Error("Active signing key does not match sender address.");
    }

    const keypair = Ed25519Keypair.fromSecretKey(keyMaterial.privateKey);
    const client = this.getClient();
    const amount = BigInt(p.amountRaw);

    const tx = await buildTransferTransaction({
      client,
      sender: p.senderAddress,
      recipient: p.recipient,
      coinType: p.coinType,
      amount,
    });

    const gasPrice = await client.getReferenceGasPrice();
    const budget = BigInt(gasPrice) * 300_000n;
    const gasBudgetMist = budget > 50_000_000n ? budget : 50_000_000n;
    tx.setGasBudget(Number(gasBudgetMist));

    try {
      const result = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
        options: { showEffects: true },
      });
      const digest = result.digest;
      return {
        digest,
        explorerUrl: getTransactionExplorerUrl(p.environment, digest),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[sui] execute failed (sanitized)", msg);
      if (/InsufficientCoin|insufficient/i.test(msg)) {
        throw new Error("Insufficient balance or gas.");
      }
      if (/timeout|ETIMEDOUT|fetch failed/i.test(msg)) {
        throw new Error("Network unavailable or RPC timeout.");
      }
      throw new Error("Transaction failed. Check your balance and try again.");
    }
  }
}
