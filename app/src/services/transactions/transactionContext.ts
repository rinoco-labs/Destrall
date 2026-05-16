import { Transaction, type TransactionObjectArgument } from "@mysten/sui/transactions";
import type { SuiChainEnvironment } from "../../config/chains/sui";

/** Alias for a coin or balance produced by a prior PTB step. */
export type TransactionAliasValue = TransactionObjectArgument;

/**
 * Shared state while composing a multi-step programmable transaction.
 * Package builders append commands to `tx` and register outputs by alias.
 */
export type TransactionBuildContext = {
  tx: Transaction;
  senderAddress: string;
  suiEnvironment: SuiChainEnvironment;
  aliases: Map<string, TransactionAliasValue>;
  gasBudgetMist?: bigint;
};

export function createTransactionBuildContext(params: {
  senderAddress: string;
  suiEnvironment: SuiChainEnvironment;
}): TransactionBuildContext {
  const tx = new Transaction();
  tx.setSender(params.senderAddress);
  return {
    tx,
    senderAddress: params.senderAddress,
    suiEnvironment: params.suiEnvironment,
    aliases: new Map(),
  };
}

export function setAlias(ctx: TransactionBuildContext, alias: string, value: TransactionAliasValue): void {
  ctx.aliases.set(alias, value);
}

export function getAlias(ctx: TransactionBuildContext, alias: string): TransactionAliasValue {
  const v = ctx.aliases.get(alias);
  if (!v) {
    throw new Error(`[tx-compose] Missing alias "${alias}" — step ordering may be invalid.`);
  }
  return v;
}

export function requireAlias(ctx: TransactionBuildContext, alias: string): TransactionAliasValue | undefined {
  return ctx.aliases.get(alias);
}
