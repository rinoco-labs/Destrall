import type { Transaction } from "@mysten/sui/transactions";
import { SUI_COIN_TYPE } from "../../config/chains/sui";
import type { AssetMovement, TransactionCategory, TransactionStep } from "./transactionDisplay.types";
import { formatAddress, formatCoinType, formatMistToDisplay } from "./transactionFormatter";

type CommandData = ReturnType<Transaction["getData"]>["commands"][number];

const NAVI_PACKAGE_PREFIXES = ["0x83429", "0x977dc"];
const AFTERMATH_PACKAGE_PREFIXES = ["0xaf690", "0x0df4f"];

function commandKind(cmd: CommandData): string {
  if (cmd && typeof cmd === "object" && "$kind" in cmd) {
    return String((cmd as { $kind: string }).$kind);
  }
  return "Unknown";
}

function moveCall(cmd: CommandData): { package: string; module: string; function: string } | null {
  if (commandKind(cmd) !== "MoveCall") return null;
  const raw = cmd as {
    MoveCall?: { package?: string; module?: string; function?: string };
    package?: string;
    module?: string;
    function?: string;
  };
  const mc = raw.MoveCall ?? raw;
  if (!mc.package || !mc.function) return null;
  return { package: mc.package, module: mc.module ?? "", function: mc.function };
}

function inferCategoryFromMoveCall(mc: { package: string; module: string; function: string }): TransactionCategory {
  const fn = mc.function.toLowerCase();
  const mod = mc.module.toLowerCase();
  const pkg = mc.package.toLowerCase();

  if (fn.includes("swap") || mod.includes("swap") || mod.includes("router")) return "swap";
  if (fn.includes("deposit") || fn.includes("supply") || fn.includes("lend")) return "yield_deposit";
  if (fn.includes("withdraw") || fn.includes("redeem") || fn.includes("unstake")) return "yield_withdraw";
  if (fn.includes("transfer") && !fn.includes("objects")) return "send";

  if (NAVI_PACKAGE_PREFIXES.some((p) => pkg.startsWith(p.toLowerCase()))) {
    if (fn.includes("deposit") || fn.includes("supply")) return "yield_deposit";
    if (fn.includes("withdraw")) return "yield_withdraw";
    return "contract_interaction";
  }

  if (AFTERMATH_PACKAGE_PREFIXES.some((p) => pkg.startsWith(p.toLowerCase()))) {
    return "swap";
  }

  if (mod.includes("nft") || fn.includes("mint") || fn.includes("transfer_nft")) return "nft";

  return "contract_interaction";
}

function describeCommand(cmd: CommandData, index: number): TransactionStep {
  const kind = commandKind(cmd);

  if (kind === "MoveCall") {
    const mc = moveCall(cmd);
    if (!mc) return { index, title: "Contract call", detail: "Move call" };
    const category = inferCategoryFromMoveCall(mc);
    const pkgShort = formatAddress(mc.package, 8, 4);
    if (category === "swap") {
      return { index, title: "Swap tokens", detail: `${mc.module}::${mc.function} (${pkgShort})` };
    }
    if (category === "yield_deposit") {
      return { index, title: "Deposit into yield", detail: `${mc.module}::${mc.function}` };
    }
    if (category === "yield_withdraw") {
      return { index, title: "Withdraw from yield", detail: `${mc.module}::${mc.function}` };
    }
    return {
      index,
      title: "Contract interaction",
      detail: `${mc.module}::${mc.function} · ${pkgShort}`,
    };
  }

  if (kind === "TransferObjects") {
    return { index, title: "Transfer objects", detail: "Move coins or objects to another address" };
  }

  if (kind === "SplitCoins") {
    return { index, title: "Split coins", detail: "Prepare coin amounts for transfers or payments" };
  }

  if (kind === "MergeCoins") {
    return { index, title: "Merge coins", detail: "Combine coin objects" };
  }

  if (kind === "Publish") {
    return { index, title: "Publish package", detail: "Deploy new Move package on chain" };
  }

  if (kind === "MakeMoveVec") {
    return { index, title: "Prepare move vector", detail: "Package arguments for a move call" };
  }

  return { index, title: kind, detail: "Programmable transaction step" };
}

function inferOverallCategory(steps: TransactionStep[], commands: CommandData[]): TransactionCategory {
  const moveCalls = commands.map((c) => moveCall(c)).filter(Boolean) as {
    package: string;
    module: string;
    function: string;
  }[];

  if (moveCalls.length === 0) {
    if (commands.some((c) => commandKind(c) === "TransferObjects")) return "send";
    return "unknown";
  }

  const categories = moveCalls.map((mc) => inferCategoryFromMoveCall(mc));
  const unique = new Set(categories);

  if (unique.size === 1) return categories[0] ?? "contract_interaction";
  if (unique.has("swap") && (unique.has("yield_deposit") || unique.has("yield_withdraw"))) {
    return "rebalance";
  }
  if (steps.length > 1) return "contract_interaction";
  return categories[0] ?? "contract_interaction";
}

function buildHeadline(category: TransactionCategory, steps: TransactionStep[], decoded: boolean): string {
  if (!decoded) return "This transaction could not be fully decoded.";
  switch (category) {
    case "send":
      return "Send assets from your wallet";
    case "swap":
      return "Swap tokens on a DEX";
    case "yield_deposit":
      return "Deposit assets into a yield protocol";
    case "yield_withdraw":
      return "Withdraw assets from a yield protocol";
    case "rebalance":
      return "Multi-step rebalance (swap + yield)";
    case "nft":
      return "NFT interaction";
    case "contract_interaction":
      return steps.length > 1 ? "Multi-step contract interaction" : "Contract interaction";
    default:
      return "Review this transaction carefully";
  }
}

export function buildStepsFromTransaction(tx: Transaction | null): TransactionStep[] {
  if (!tx) return [];
  const data = tx.getData();
  return data.commands.map((cmd, index) => describeCommand(cmd, index + 1));
}

export function buildCategoryFromTransaction(tx: Transaction | null): TransactionCategory {
  if (!tx) return "unknown";
  const data = tx.getData();
  const steps = buildStepsFromTransaction(tx);
  return inferOverallCategory(steps, data.commands);
}

export function buildHeadlineForTransaction(
  tx: Transaction | null,
  decoded: boolean,
): { category: TransactionCategory; headline: string; subheadline?: string } {
  const category = buildCategoryFromTransaction(tx);
  const steps = buildStepsFromTransaction(tx);
  const headline = buildHeadline(category, steps, decoded);
  const subheadline =
    steps.length > 1 ? `${steps.length} programmable transaction steps` : undefined;
  return { category, headline, subheadline };
}

export function extractGasBudget(tx: Transaction | null): string | undefined {
  if (!tx) return undefined;
  const budget = tx.getData().gasData.budget;
  if (budget == null) return undefined;
  return formatMistToDisplay(budget, "SUI");
}

/** Best-effort movements from balance-change simulation rows. */
function formatBalanceChangeAmount(amount: bigint, coinType: string): string {
  const { symbol } = formatCoinType(coinType || SUI_COIN_TYPE);
  const isSui =
    coinType === SUI_COIN_TYPE ||
    coinType.endsWith("::sui::SUI") ||
    symbol === "SUI";
  if (isSui) return formatMistToDisplay(amount, "SUI");
  return `${amount.toString()} ${symbol}`;
}

export function movementsFromBalanceChanges(
  changes: { coinType: string; amount: string; owner?: string }[],
  accountAddress: string,
): { send: AssetMovement[]; receive: AssetMovement[] } {
  const youSend: AssetMovement[] = [];
  const youReceive: AssetMovement[] = [];
  const normalizedAccount = accountAddress.toLowerCase();

  for (const change of changes) {
    const amount = BigInt(change.amount);
    if (amount === 0n) continue;

    const owner = typeof change.owner === "string" ? change.owner.toLowerCase() : "";
    if (owner && owner !== normalizedAccount) continue;

    const coinType = change.coinType || SUI_COIN_TYPE;
    const { symbol } = formatCoinType(coinType);
    const displayAmount = formatBalanceChangeAmount(amount < 0n ? -amount : amount, coinType);
    const movement: AssetMovement = {
      direction: amount < 0n ? "send" : "receive",
      amount: displayAmount,
      symbol,
      coinType,
    };

    if (amount < 0n) youSend.push(movement);
    else youReceive.push(movement);
  }

  return { send: youSend, receive: youReceive };
}
