import {
  Transaction,
  TransactionDataBuilder,
  type TransactionObjectArgument,
} from "@mysten/sui/transactions";
import type { Argument, Command } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";

/**
 * Merges another programmable transaction into `parent`, optionally stripping
 * terminal TransferObjects to the sender so outputs can feed a later step.
 */
export function mergeProgrammableTransaction(params: {
  parent: Transaction;
  child: Transaction;
  senderAddress: string;
  stripTerminalTransferToSender?: boolean;
}): { outputCoins: TransactionObjectArgument[]; insertedCommandCount: number } {
  const { parent, child, senderAddress, stripTerminalTransferToSender = true } = params;
  const childData = child.getData() as TransactionDataBuilder;
  const parentData = parent.getData() as TransactionDataBuilder;

  let commands = [...childData.commands];
  let outputCoins: TransactionObjectArgument[] = [];

  if (stripTerminalTransferToSender && commands.length > 0) {
    const extracted = extractTerminalTransferCoins(commands, childData, senderAddress);
    if (extracted) {
      outputCoins = extracted.coins;
      commands = extracted.remainingCommands;
      console.info("[ptb] stripped terminal transfer; output coins:", outputCoins.length);
    }
  }

  if (commands.length === 0 && outputCoins.length === 0) {
    throw new Error("[ptb] Swap transaction had no composable commands.");
  }

  const atIndex = parentData.commands.length;
  const slice = new TransactionDataBuilder({
    version: 2,
    sender: childData.sender,
    expiration: childData.expiration,
    gasData: childData.gasData,
    inputs: childData.inputs,
    commands,
  });
  parentData.insertTransaction(atIndex, slice);

  if (outputCoins.length === 0) {
    const lastIdx = atIndex + commands.length - 1;
    outputCoins = [
      {
        $kind: "Result",
        Result: lastIdx,
      } as TransactionObjectArgument,
    ];
    console.info("[ptb] using last command result as swap output", lastIdx);
  }

  return { outputCoins, insertedCommandCount: commands.length };
}

function extractTerminalTransferCoins(
  commands: Command[],
  childData: TransactionDataBuilder,
  senderAddress: string,
): { coins: TransactionObjectArgument[]; remainingCommands: Command[] } | null {
  const sender = normalizeSuiAddress(senderAddress);
  for (let i = commands.length - 1; i >= 0; i--) {
    const cmd = commands[i];
    if (cmd.$kind !== "TransferObjects") continue;
    const addrArg = cmd.TransferObjects.address;
    if (!isSenderPureAddress(addrArg, childData, sender)) continue;
    const coins = cmd.TransferObjects.objects.map((o) => o as TransactionObjectArgument);
    const remainingCommands = [...commands.slice(0, i), ...commands.slice(i + 1)];
    return { coins, remainingCommands };
  }
  return null;
}

function isSenderPureAddress(addrArg: Argument, data: TransactionDataBuilder, sender: string): boolean {
  if (addrArg.$kind !== "Input") return false;
  const input = data.inputs[addrArg.Input];
  if (!input || input.$kind !== "Pure") return false;
  try {
    const rawBytes = input.Pure.bytes as string | Uint8Array;
    const decoded =
      typeof rawBytes === "string"
        ? Buffer.from(rawBytes, "base64")
        : rawBytes instanceof Uint8Array
          ? rawBytes
          : null;
    if (!decoded || decoded.length !== 32) return false;
    const hex = `0x${Buffer.from(decoded).toString("hex")}`;
    return normalizeSuiAddress(hex) === sender;
  } catch {
    return false;
  }
}

export async function transactionToBytes(tx: Transaction, client: Parameters<Transaction["build"]>[0]["client"]): Promise<Uint8Array> {
  return tx.build({ client });
}
