import { tryParseDappTransaction } from "../../services/transactions/decodeTransaction.service";
import type {
  InspectApprovalInput,
  TransactionApprovalView,
  TransactionCategory,
} from "./transactionDisplay.types";
import {
  buildHeadlineForTransaction,
  buildStepsFromTransaction,
  extractGasBudget,
  movementsFromBalanceChanges,
} from "./transactionSummaryBuilder";
import { analyzeTransactionRisks } from "./transactionRiskAnalyzer";
import {
  decodeMessageFromBase64,
  formatAddress,
  prettyJson,
  resolveDappDisplayName,
} from "./transactionFormatter";
import type { SimulationResult } from "./transactionDisplay.types";

function kindFromMethod(method: string): TransactionApprovalView["kind"] {
  if (method === "connect") return "connect";
  if (method === "disconnect") return "disconnect";
  if (method === "sui:signPersonalMessage") return "sign_message";
  if (method === "sui:signAndExecuteTransaction") return "sign_and_execute";
  return "sign_transaction";
}

function titleFromKind(kind: TransactionApprovalView["kind"]): string {
  switch (kind) {
    case "connect":
      return "Connect wallet";
    case "disconnect":
      return "Disconnect wallet";
    case "sign_message":
      return "Sign message";
    case "sign_and_execute":
      return "Sign & execute";
    default:
      return "Sign transaction";
  }
}

function buildConnectView(input: InspectApprovalInput): TransactionApprovalView {
  const dapp = resolveDappDisplayName(input.origin);
  return {
    kind: "connect",
    category: "connect",
    title: "Connect wallet",
    headline: `${dapp.displayName} wants to connect to your wallet`,
    subheadline: "This site will be able to request signatures after you approve.",
    dapp: {
      origin: input.origin,
      hostname: dapp.hostname,
      displayName: dapp.displayName,
      faviconUrl: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dapp.hostname)}&sz=64`,
    },
    accountLabel: input.accountLabel,
    accountAddress: input.accountAddress,
    networkLabel: input.networkLabel,
    parseConfidence: "high",
    decoded: true,
    youSend: [],
    youReceive: [],
    steps: [],
    fees: [],
    warnings: analyzeTransactionRisks({
      input,
      category: "connect",
      parseConfidence: "high",
      decoded: true,
      stepsCount: 0,
      youSend: [],
    }),
    advancedPayload: prettyJson({ method: "connect", origin: input.origin }),
  };
}

function buildDisconnectView(input: InspectApprovalInput): TransactionApprovalView {
  const dapp = resolveDappDisplayName(input.origin);
  return {
    kind: "disconnect",
    category: "disconnect",
    title: "Disconnect wallet",
    headline: `Disconnect from ${dapp.displayName}`,
    dapp: {
      origin: input.origin,
      hostname: dapp.hostname,
      displayName: dapp.displayName,
    },
    accountLabel: input.accountLabel,
    accountAddress: input.accountAddress,
    networkLabel: input.networkLabel,
    parseConfidence: "high",
    decoded: true,
    youSend: [],
    youReceive: [],
    steps: [],
    fees: [],
    warnings: [],
    advancedPayload: prettyJson({ method: "disconnect", origin: input.origin }),
  };
}

function buildSignMessageView(input: InspectApprovalInput, payload: Record<string, unknown>): TransactionApprovalView {
  const dapp = resolveDappDisplayName(input.origin);
  const messageBase64 = String(payload.message ?? "");
  const preview = decodeMessageFromBase64(messageBase64);
  const isReadable = preview.length > 0 && !preview.startsWith("Binary message");

  return {
    kind: "sign_message",
    category: "sign_message",
    title: "Sign message",
    headline: isReadable ? "Sign this message" : "Sign binary message",
    subheadline: isReadable ? undefined : "This message is not plain text.",
    dapp: {
      origin: input.origin,
      hostname: dapp.hostname,
      displayName: dapp.displayName,
      faviconUrl: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dapp.hostname)}&sz=64`,
    },
    accountLabel: input.accountLabel,
    accountAddress: input.accountAddress,
    networkLabel: input.networkLabel,
    parseConfidence: isReadable ? "high" : "medium",
    decoded: true,
    youSend: [],
    youReceive: [],
    steps: [],
    fees: [],
    warnings: analyzeTransactionRisks({
      input,
      category: "sign_message",
      parseConfidence: isReadable ? "high" : "medium",
      decoded: true,
      stepsCount: 0,
      youSend: [],
    }),
    messagePreview: preview,
    advancedPayload: prettyJson({ messageBase64 }),
  };
}

function buildTransactionView(
  input: InspectApprovalInput,
  payload: Record<string, unknown>,
  simulation?: SimulationResult,
): TransactionApprovalView {
  const dapp = resolveDappDisplayName(input.origin);
  const kind = kindFromMethod(input.method);
  const txDataJson = String(payload.txData ?? "");
  const parsed = tryParseDappTransaction(txDataJson);
  const decoded = Boolean(parsed.tx);
  const parseConfidence: "high" | "medium" | "low" = decoded
    ? "high"
    : parsed.txBytes
      ? "medium"
      : "low";

  const { category, headline, subheadline } = buildHeadlineForTransaction(parsed.tx, decoded);
  const steps = buildStepsFromTransaction(parsed.tx);

  let youSend: TransactionApprovalView["youSend"] = [];
  let youReceive: TransactionApprovalView["youReceive"] = [];

  if (simulation?.balanceChanges?.length) {
    const movements = movementsFromBalanceChanges(simulation.balanceChanges, input.accountAddress);
    youSend = movements.send;
    youReceive = movements.receive;
  }

  const fees: TransactionApprovalView["fees"] = [];
  const gasFromSim = simulation?.gasEstimate;
  const gasFromTx = extractGasBudget(parsed.tx);
  if (gasFromSim) {
    fees.push({ label: "Estimated gas", amount: gasFromSim, note: "From network simulation" });
  } else if (gasFromTx) {
    fees.push({ label: "Gas budget", amount: gasFromTx, note: "Set in transaction" });
  }

  const warnings = analyzeTransactionRisks({
    input,
    category,
    parseConfidence,
    decoded,
    stepsCount: steps.length,
    youSend,
    simulation,
  });

  return {
    kind,
    category,
    title: titleFromKind(kind),
    headline,
    subheadline,
    dapp: {
      origin: input.origin,
      hostname: dapp.hostname,
      displayName: dapp.displayName,
      faviconUrl: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dapp.hostname)}&sz=64`,
    },
    accountLabel: input.accountLabel,
    accountAddress: input.accountAddress,
    networkLabel: input.networkLabel,
    parseConfidence,
    decoded,
    youSend,
    youReceive,
    steps,
    fees,
    warnings,
    simulation,
    advancedPayload: prettyJson(parsed.rawPayload),
  };
}

export function inspectApprovalRequest(
  input: InspectApprovalInput,
  options?: { simulation?: SimulationResult },
): TransactionApprovalView {
  const payload = (input.payload ?? {}) as Record<string, unknown>;

  if (input.method === "connect") return buildConnectView(input);
  if (input.method === "disconnect") return buildDisconnectView(input);
  if (input.method === "sui:signPersonalMessage") return buildSignMessageView(input, payload);

  if (input.method === "sui:signTransaction" || input.method === "sui:signAndExecuteTransaction") {
    return buildTransactionView(input, payload, options?.simulation);
  }

  const dapp = resolveDappDisplayName(input.origin);
  return {
    kind: "sign_transaction",
    category: "unknown",
    title: "Wallet request",
    headline: "Unknown wallet request",
    dapp: {
      origin: input.origin,
      hostname: dapp.hostname,
      displayName: dapp.displayName,
    },
    accountLabel: input.accountLabel,
    accountAddress: input.accountAddress,
    networkLabel: input.networkLabel,
    parseConfidence: "low",
    decoded: false,
    youSend: [],
    youReceive: [],
    steps: [],
    fees: [],
    warnings: analyzeTransactionRisks({
      input,
      category: "unknown",
      parseConfidence: "low",
      decoded: false,
      stepsCount: 0,
      youSend: [],
    }),
    advancedPayload: prettyJson(payload),
  };
}

export function categoryLabel(category: TransactionCategory): string {
  const labels: Record<TransactionCategory, string> = {
    send: "Send",
    swap: "Swap",
    yield_deposit: "Yield deposit",
    yield_withdraw: "Yield withdraw",
    rebalance: "Rebalance",
    trigger_execution: "Trigger",
    contract_interaction: "Contract",
    nft: "NFT",
    connect: "Connect",
    disconnect: "Disconnect",
    sign_message: "Message",
    unknown: "Unknown",
  };
  return labels[category] ?? "Transaction";
}
