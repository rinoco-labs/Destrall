import { randomUUID } from "node:crypto";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { isValidSuiAddress, normalizeSuiAddress } from "@mysten/sui/utils";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { SuiChainEnvironment } from "../../../../config/chains/sui";
import type {
  TransferExecuteResult,
  TransferPrepareResult,
  TransferPrepareSummary,
} from "../../../../types/blockchain";
import {
  formatTokenAmount,
  insufficientBalanceMessage,
  logTokenAmountConversion,
  parseTokenAmount,
  SUI_DECIMALS,
} from "../../../../shared/tokens/amounts";
import { deriveSuiAccountFromMnemonic } from "./sui-wallet.service";
import { walletSession } from "../../../wallet/walletSession";
import { walletService } from "../../../wallet/walletService";
import { SuiTokenMetadataService } from "./sui-token-metadata.service";
import { getTransactionExplorerUrl } from "./sui-explorer.service";
import { resolveOnChainCoinType } from "./sui-coin-type-resolve";
import {
  isNormalizedSuiNativeCoin,
  normalizeSuiCoinType,
} from "./sui-coin-type-normalize";

type PendingTransfer = {
  expiresAt: number;
  accountId: string;
  environment: SuiChainEnvironment;
  senderAddress: string;
  recipient: string;
  coinType: string;
  amountRaw: string;
  decimals: number;
  symbol: string;
};

const pending = new Map<string, PendingTransfer>();
const TTL_MS = 5 * 60 * 1000;

function cleanupExpired() {
  const now = Date.now();
  for (const [id, p] of pending) {
    if (p.expiresAt < now) pending.delete(id);
  }
}

async function buildTransferTransaction(params: {
  client: SuiJsonRpcClient;
  sender: string;
  recipient: string;
  coinType: string;
  amount: bigint;
  symbol: string;
  decimals: number;
  walletBalanceRaw?: string;
}): Promise<Transaction> {
  const tx = new Transaction();
  tx.setSender(params.sender);
  const normalized = normalizeSuiCoinType(params.coinType);

  // Use SDK coin intent: draws from address balance + coin objects (SIP-58).
  // Manual getCoins/merge only sees coin objects, not fundsInAddressBalance.
  const sendCoin = isNormalizedSuiNativeCoin(normalized)
    ? tx.coin({ balance: params.amount, useGasCoin: true })
    : tx.coin({ type: normalized, balance: params.amount });

  tx.transferObjects([sendCoin], params.recipient);
  return tx;
}

async function ensureBalances(params: {
  client: SuiJsonRpcClient;
  address: string;
  coinType: string;
  amount: bigint;
  symbol: string;
  decimals: number;
  walletBalanceRaw?: string;
}) {
  const gasHeadroom = 50_000_000n;
  const normalized = normalizeSuiCoinType(params.coinType);
  const suiBal = await params.client.getBalance({ owner: params.address });
  const suiTotal = BigInt(suiBal.totalBalance);
  if (isNormalizedSuiNativeCoin(normalized)) {
    if (suiTotal < params.amount + gasHeadroom) {
      throw new Error("Insufficient SUI for the send amount plus gas reserve.");
    }
    return;
  }
  if (suiTotal < gasHeadroom) {
    throw new Error("Insufficient SUI for gas.");
  }

  const resolved = await resolveOnChainCoinType(
    params.client,
    params.address,
    params.coinType,
    params.walletBalanceRaw,
  );
  const total =
    params.walletBalanceRaw != null ? BigInt(params.walletBalanceRaw) : resolved.totalBalance;

  if (total < params.amount) {
    throw new Error(
      insufficientBalanceMessage({
        symbol: params.symbol,
        requiredRaw: params.amount,
        availableRaw: total,
        decimals: params.decimals,
      }),
    );
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
    walletDecimals?: number;
    walletBalanceRaw?: string;
    walletSymbol?: string;
  }): Promise<TransferPrepareResult> {
    cleanupExpired();
    const client = this.getClient();
    const env = this.getEnvironment();
    const meta = this.getMetadata();
    const coinMeta = await meta.getCoinMetadata(params.coinType);
    const decimals =
      typeof params.walletDecimals === "number" && Number.isFinite(params.walletDecimals)
        ? params.walletDecimals
        : coinMeta.decimals;
    if (typeof decimals !== "number" || !Number.isFinite(decimals) || decimals < 0) {
      throw new Error("Could not load decimals for this token. Refresh balances and try again.");
    }
    const symbol = params.walletSymbol?.trim() || coinMeta.symbol;

    const amountRaw = parseTokenAmount(params.amountDisplay, decimals, symbol).toString();
    const amount = BigInt(amountRaw);

    logTokenAmountConversion({
      context: "prepareTransfer",
      resolvedSymbol: symbol,
      coinType: params.coinType,
      decimals,
      humanAmount: params.amountDisplay,
      rawAmount: amountRaw,
      balanceRaw: params.walletBalanceRaw,
      validation: "start",
    });

    let recipient: string;
    try {
      recipient = normalizeSuiAddress(params.recipient.trim());
    } catch {
      throw new Error("Invalid Sui address.");
    }
    if (!isValidSuiAddress(recipient)) {
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
      symbol,
      decimals,
      walletBalanceRaw: params.walletBalanceRaw,
    });

    const tx = await buildTransferTransaction({
      client,
      sender: params.senderAddress,
      recipient,
      coinType: params.coinType,
      amount,
      symbol,
      decimals,
      walletBalanceRaw: params.walletBalanceRaw,
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
      decimals,
      symbol,
    });

    logTokenAmountConversion({
      context: "prepareTransfer",
      resolvedSymbol: symbol,
      coinType: params.coinType,
      decimals,
      humanAmount: params.amountDisplay,
      rawAmount: amountRaw,
      balanceRaw: params.walletBalanceRaw,
      validation: "ok",
    });

    const summary: TransferPrepareSummary = {
      coinType: params.coinType,
      symbol,
      decimals,
      amountRaw,
      amountFormatted: formatTokenAmount(amount, decimals),
      recipient,
      sender: params.senderAddress,
      gasBudgetMist,
      gasBudgetFormatted: formatTokenAmount(BigInt(gasBudgetMist), SUI_DECIMALS),
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

    const currentEnv = this.getEnvironment();
    if (p.environment !== currentEnv) {
      throw new Error("Network changed since this transfer was prepared. Prepare again on the correct network.");
    }

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
      symbol: p.symbol,
      decimals: p.decimals,
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
