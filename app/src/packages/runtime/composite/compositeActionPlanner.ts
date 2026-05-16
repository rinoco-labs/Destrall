import type { AssistantProposalCard } from "../../../assistant/assistantResultTypes";
import type { CompositeStepPreview } from "./compositeTypes";

export function buildCompositeProposalCard(params: {
  title: string;
  steps: CompositeStepPreview[];
  networkLabel: string;
  executionModel: "ptb" | "staged";
  estimatedDeposit?: string;
  apyText?: string;
}): AssistantProposalCard {
  const stepLines = params.steps.map((s) => `${s.index}. ${s.label}`).join("\n");
  return {
    title: params.title,
    label: params.steps.length ? params.steps[params.steps.length - 1].label : "Composite action",
    source: { type: "package", name: "DESTRALL COMPOSITE" },
    flows: params.steps.map((s) => ({
      direction: "out" as const,
      amount: "—",
      token: s.label.split(" ")[0] ?? "—",
      kind: "token" as const,
    })),
    details: [
      { k: "Execution", v: params.executionModel === "ptb" ? "Single PTB" : "Staged (multiple approvals)" },
      { k: "Network", v: params.networkLabel },
      { k: "Steps", v: stepLines },
      ...(params.estimatedDeposit ? [{ k: "Est. deposit", v: params.estimatedDeposit }] : []),
      ...(params.apyText ? [{ k: "Yield", v: params.apyText }] : []),
    ],
    note:
      params.executionModel === "ptb"
        ? "Approving signs one transaction with swap and deposit composed."
        : "Approve each step on the card in order.",
  };
}
