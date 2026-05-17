import type {
  AssetMovement,
  InspectApprovalInput,
  TransactionCategory,
  TransactionRiskWarning,
} from "./transactionDisplay.types";
import type { SimulationResult } from "./transactionDisplay.types";

export function analyzeTransactionRisks(params: {
  input: InspectApprovalInput;
  category: TransactionCategory;
  parseConfidence: "high" | "medium" | "low";
  decoded: boolean;
  stepsCount: number;
  youSend: AssetMovement[];
  simulation?: SimulationResult;
}): TransactionRiskWarning[] {
  const warnings: TransactionRiskWarning[] = [];
  const { input, category, parseConfidence, decoded, stepsCount, simulation } = params;

  if (!decoded || parseConfidence === "low") {
    warnings.push({
      id: "decode-low",
      severity: "critical",
      title: "Transaction not fully decoded",
      description:
        "Destrall could not confidently interpret this transaction. Only approve if you trust this site.",
    });
  }

  if (category === "unknown" || category === "contract_interaction") {
    warnings.push({
      id: "unknown-contract",
      severity: decoded ? "warning" : "critical",
      title: "Unknown or complex contract interaction",
      description:
        "This may move assets in ways that are not obvious. Review advanced details before approving.",
    });
  }

  if (stepsCount > 4) {
    warnings.push({
      id: "many-steps",
      severity: "warning",
      title: "Complex multi-step transaction",
      description: `This transaction has ${stepsCount} steps. Make sure you understand each step.`,
    });
  }

  if (simulation && !simulation.ok) {
    warnings.push({
      id: "sim-failed",
      severity: "warning",
      title: "Simulation failed",
      description:
        simulation.errorMessage ??
        "Could not simulate this transaction. It may fail on chain or cost more than estimated.",
    });
  }

  try {
    const host = new URL(input.origin).hostname;
    if (host === "localhost" || host.endsWith(".local")) {
      warnings.push({
        id: "local-origin",
        severity: "warning",
        title: "Local development site",
        description: "You are connecting to a local development origin.",
      });
    }
  } catch {
    warnings.push({
      id: "bad-origin",
      severity: "critical",
      title: "Invalid site origin",
      description: "The requesting site origin could not be verified.",
    });
  }

  if (params.youSend.length === 0 && category !== "connect" && category !== "sign_message") {
    warnings.push({
      id: "no-visible-outflow",
      severity: "info",
      title: "No obvious outgoing assets detected",
      description:
        "Outgoing transfers may still be hidden inside contract calls. Check steps and advanced details.",
    });
  }

  return warnings;
}
