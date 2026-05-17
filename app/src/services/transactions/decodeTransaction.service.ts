import { Transaction } from "@mysten/sui/transactions";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { fromBase64 } from "@mysten/sui/utils";

export type ParsedDappTransaction = {
  tx: Transaction | null;
  txBytes: Uint8Array | null;
  rawPayload: unknown;
  parseError?: string;
};

export type DappTxDataEnvelope = {
  version?: number;
  transaction?: unknown;
  transactionBlock?: unknown;
  account?: { address?: string };
  chain?: string;
  bytes?: unknown;
  txBytes?: unknown;
  tx?: unknown;
};

function decodeBase64OrUtf8(value: string): Uint8Array {
  const trimmed = value.replace(/\s+/g, "");
  try {
    if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
      const decoded = fromBase64(trimmed);
      if (decoded.length > 0) return decoded;
    }
  } catch {
    /* fall through */
  }
  return new Uint8Array(Buffer.from(value, "utf8"));
}

function toUint8Array(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (typeof value === "string") return decodeBase64OrUtf8(value);
  if (Array.isArray(value) && value.every((v) => typeof v === "number")) {
    return new Uint8Array(value as number[]);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.type === "Buffer" && Array.isArray(obj.data)) {
      return new Uint8Array(obj.data as number[]);
    }
    if (typeof obj.data === "string") return decodeBase64OrUtf8(obj.data);
  }
  return null;
}

function parseTxDataEnvelope(txDataJson: string): { envelope: DappTxDataEnvelope | null; raw: unknown } {
  try {
    const raw = JSON.parse(txDataJson);
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return { envelope: raw as DappTxDataEnvelope, raw };
    }
    return { envelope: null, raw };
  } catch {
    return { envelope: null, raw: txDataJson };
  }
}

function senderFromEnvelope(envelope: DappTxDataEnvelope | null, fallback?: string): string | undefined {
  const fromAccount = envelope?.account?.address;
  if (typeof fromAccount === "string" && fromAccount.length > 0) return fromAccount;
  return fallback;
}

function transactionJsonFromEnvelope(envelope: DappTxDataEnvelope | null): string | null {
  if (!envelope) return null;
  const candidate = envelope.transaction ?? envelope.transactionBlock;
  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    if (!trimmed || trimmed === "{}" || trimmed === "[object Object]") return null;
    return candidate;
  }
  if (candidate && typeof candidate === "object") {
    const keys = Object.keys(candidate as object);
    if (keys.length === 0) return null;
    return JSON.stringify(candidate);
  }
  return null;
}

function tryTransactionFromJson(txJson: string): Transaction | null {
  try {
    return Transaction.from(txJson);
  } catch {
    return null;
  }
}

/** Parse wallet-standard / dapp JSON into raw transaction bytes when already serialized as BCS. */
export function parseSuiTransactionBytesFromDappJson(txDataJson: string): Uint8Array {
  const { envelope } = parseTxDataEnvelope(txDataJson);

  const txJson = transactionJsonFromEnvelope(envelope);
  if (txJson) {
    const asBytes = toUint8Array(txJson);
    if (asBytes && asBytes.length > 0 && !txJson.trim().startsWith("{")) {
      return asBytes;
    }
    throw new Error(
      "Transaction must be built before signing. Retry the action after updating Destrall.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(txDataJson);
  } catch {
    return decodeBase64OrUtf8(txDataJson);
  }

  if (typeof parsed === "string") {
    return decodeBase64OrUtf8(parsed);
  }

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const candidates = [obj.bytes, obj.txBytes, obj.tx];
    for (const candidate of candidates) {
      const bytes = toUint8Array(candidate);
      if (bytes && bytes.length > 0) return bytes;
    }

    const emptyTx =
      obj.transaction &&
      typeof obj.transaction === "object" &&
      Object.keys(obj.transaction as object).length === 0;
    if (emptyTx) {
      throw new Error(
        "Transaction data was not serialized by the wallet bridge. Reload the dapp and try again.",
      );
    }
  }

  throw new Error("Could not parse transaction bytes from dapp request.");
}

/** Build signable BCS bytes from wallet-standard v2 JSON (requires RPC resolution). */
export async function resolveTransactionBytesFromDappJson(
  txDataJson: string,
  options: { client: ClientWithCoreApi; sender?: string },
): Promise<Uint8Array> {
  const { envelope } = parseTxDataEnvelope(txDataJson);
  const txJson = transactionJsonFromEnvelope(envelope);

  if (txJson) {
    const tx = Transaction.from(txJson);
    const sender = senderFromEnvelope(envelope, options.sender);
    if (sender && !tx.getData().sender) {
      tx.setSender(sender);
    }
    return tx.build({ client: options.client });
  }

  return parseSuiTransactionBytesFromDappJson(txDataJson);
}

export function tryParseDappTransaction(txDataJson: string): ParsedDappTransaction {
  const { envelope, raw } = parseTxDataEnvelope(txDataJson);
  const rawPayload = envelope ?? raw;

  const txJson = transactionJsonFromEnvelope(envelope);
  if (txJson) {
    const tx = tryTransactionFromJson(txJson);
    if (tx) {
      return { tx, txBytes: null, rawPayload };
    }
    return {
      tx: null,
      txBytes: null,
      rawPayload,
      parseError: "Could not parse transaction JSON from dapp",
    };
  }

  if (
    envelope?.transaction &&
    typeof envelope.transaction === "object" &&
    Object.keys(envelope.transaction as object).length === 0
  ) {
    return {
      tx: null,
      txBytes: null,
      rawPayload,
      parseError: "Transaction was empty (not serialized). Reload the dapp and try again.",
    };
  }

  try {
    const txBytes = parseSuiTransactionBytesFromDappJson(txDataJson);
    try {
      const tx = Transaction.from(txBytes);
      return { tx, txBytes, rawPayload };
    } catch {
      const tx = tryTransactionFromJson(txDataJson);
      if (tx) return { tx, txBytes, rawPayload };
      return {
        tx: null,
        txBytes,
        rawPayload,
        parseError: "Could not build transaction from bytes",
      };
    }
  } catch (error) {
    const tx = tryTransactionFromJson(txDataJson);
    if (tx) return { tx, txBytes: null, rawPayload };
    return {
      tx: null,
      txBytes: null,
      rawPayload,
      parseError: error instanceof Error ? error.message : "Could not parse transaction",
    };
  }
}
