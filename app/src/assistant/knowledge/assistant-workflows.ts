import type { AssistantWorkflowStep } from "./assistant-tools.types";

/** Standard approval flow shown on help pages and referenced in tool docs. */
export const STANDARD_ASSISTANT_FLOW: AssistantWorkflowStep[] = [
  { label: "You ask", detail: "Natural language in Assistant chat" },
  { label: "Assistant analyzes", detail: "Reads wallet context and picks the right tool" },
  { label: "Proposal card", detail: "Swap, send, yield, trigger, or rebalance preview" },
  { label: "You approve", detail: "Nothing executes without your explicit tap" },
  { label: "Execution", detail: "Wallet signs; on-chain result appears in chat" },
];

export const TRIGGER_MONITOR_FLOW: AssistantWorkflowStep[] = [
  { label: "You describe a rule", detail: "Price, schedule, or recurring yield action" },
  { label: "Trigger proposal", detail: "Review limits, asset, and schedule on the card" },
  { label: "Pre-approve", detail: "Save trigger with approved execution bounds" },
  { label: "App monitors", detail: "Checks conditions while Destrall is running" },
  { label: "Auto-execute", detail: "Only within what you pre-approved" },
];
