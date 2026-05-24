import type { CriticalFlowType } from "../../shared/criticalFlows";
import type { AssistantStructuredResult } from "../../assistant/assistantResultTypes";
import { useCriticalFlow } from "@/hooks/useCriticalFlow";

function criticalFlowForBlock(block: AssistantStructuredResult): CriticalFlowType | null {
  if (!("status" in block) || block.status !== "pending") {
    return null;
  }

  switch (block.type) {
    case "send_proposal":
      return "approving_send_proposal";
    case "swap_proposal":
      return "approving_swap_proposal";
    case "navi_deposit_proposal":
    case "navi_withdraw_proposal":
      return "approving_yield_proposal";
    case "composite_swap_then_deposit":
      return "approving_composite_proposal";
    case "rebalance_proposal":
      return "approving_rebalance_proposal";
    case "trigger_proposal":
      return "approving_trigger_proposal";
    default:
      return null;
  }
}

export function PendingProposalCriticalFlows({ blocks }: { blocks: AssistantStructuredResult[] }) {
  const activeFlows = new Set<CriticalFlowType>();
  for (const block of blocks) {
    const flow = criticalFlowForBlock(block);
    if (flow) activeFlows.add(flow);
  }

  useCriticalFlow("approving_send_proposal", activeFlows.has("approving_send_proposal"));
  useCriticalFlow("approving_swap_proposal", activeFlows.has("approving_swap_proposal"));
  useCriticalFlow("approving_yield_proposal", activeFlows.has("approving_yield_proposal"));
  useCriticalFlow("approving_composite_proposal", activeFlows.has("approving_composite_proposal"));
  useCriticalFlow("approving_rebalance_proposal", activeFlows.has("approving_rebalance_proposal"));
  useCriticalFlow("approving_trigger_proposal", activeFlows.has("approving_trigger_proposal"));

  return null;
}
