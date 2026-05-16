import type { HowItWorksSection } from "./assistant-tools.types";
import { ASSISTANT_TOOLS } from "./assistant-tools.registry";

/** Conceptual sections for the How It Works page — not duplicated per tool. */
export const HOW_IT_WORKS_SECTIONS: HowItWorksSection[] = [
  {
    id: "assistant",
    title: "What is the Assistant?",
    summary:
      "Destrall’s on-device copilot for Sui portfolios — analytical, proposal-first, and never able to sign without you.",
    bullets: [
      "Runs locally with your downloaded AI model (no cloud required for chat).",
      "Reads wallet balances, Navi pools/positions, contacts, and triggers from app context.",
      "Prepares actions as cards; you always approve before anything hits the chain.",
    ],
  },
  {
    id: "approvals",
    title: "Transaction approvals",
    summary: "Every on-chain change flows through your wallet with an explicit approve step.",
    bullets: [
      "Proposal cards show tokens, amounts, routes, and warnings before signing.",
      "The Assistant cannot execute from chat text alone — use Approve on the card.",
      "Dismiss clears a suggestion without broadcasting a transaction.",
    ],
  },
  {
    id: "actions",
    title: "How actions work",
    summary: "Registered package actions power swaps, yield, sends, triggers, and more.",
    bullets: [
      "Actions are declared in packages and invoked by the Assistant tool router.",
      "Read-only actions (pools, balances) show data cards without signing.",
      "Transaction templates always require confirmation on a proposal card.",
    ],
  },
  {
    id: "proposals",
    title: "Proposal cards",
    summary: "Structured UI for reviewing exactly what will be signed.",
    bullets: [
      "Swap, send, Navi, composite, rebalance, and trigger flows each have dedicated card layouts.",
      "Pending proposals stay in chat context until you approve or dismiss.",
      "Quotes and estimates can change — refresh if a card looks stale.",
    ],
  },
  {
    id: "automation",
    title: "Automation & triggers",
    summary: "Pre-approved rules monitored while Destrall is running.",
    bullets: [
      "Price, schedule, and recurring yield triggers all start from a review card.",
      "Pause, resume, or delete from the Triggers page or via chat.",
      "Background execution is limited — keep Destrall open for reliable monitoring.",
    ],
  },
];

export const ASSISTANT_OVERVIEW_BLURB =
  "I help you understand your Sui portfolio and prepare swaps, sends, Navi yield, composite flows, rebalancing plans, and automation triggers — always as proposal cards you approve. I do not sign transactions or hold your keys.";

/** Tool ids surfaced on the Assistant Tools page (ordered). */
export const ASSISTANT_TOOLS_PAGE_ORDER: string[] = [
  "swap",
  "send",
  "yield",
  "composite",
  "triggers",
  "scheduled-actions",
  "rebalancing",
  "portfolio-analysis",
  "contacts",
  "portfolio-insights",
  "transaction-proposals",
];

/** Starter chips on empty Assistant chat — prompts route via local planner / tool router. */
export const ASSISTANT_STARTER_PROMPTS: { label: string; prompt: string }[] = [
  { label: "What can you do?", prompt: "What can you do?" },
  { label: "Show my portfolio", prompt: "Show my portfolio" },
  { label: "Best APY pools", prompt: "What are the best APY pools?" },
  { label: "What tokens can I swap?", prompt: "What tokens can I swap?" },
  { label: "Rebalance my portfolio", prompt: "Rebalance my portfolio" },
];

export function toolsForAssistantToolsPage() {
  const order = new Map(ASSISTANT_TOOLS_PAGE_ORDER.map((id, i) => [id, i]));
  return [...ASSISTANT_TOOLS].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
}
