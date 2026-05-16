import type { AssistantCapabilitiesResult } from "../assistantResultTypes";
import type { AssistantTool, CapabilityHelpMatch } from "./assistant-tools.types";
import { ASSISTANT_TOOLS, getAssistantTool, listAssistantTools } from "./assistant-tools.registry";
import { packageActionsFromManifests } from "./assistant-tools.manifest-sync";

/** Tools shown on the in-chat capabilities card (ordered). */
export const CAPABILITY_CARD_TOOL_IDS = [
  "portfolio-analysis",
  "swap",
  "send",
  "yield",
  "rebalancing",
  "composite",
  "triggers",
] as const;

const CAPABILITY_TAGLINES: Record<string, string> = {
  "portfolio-analysis": "View balances, allocations, risk, and idle assets",
  swap: "Convert tokens using Aftermath quotes",
  send: "Send tokens to contacts or wallet addresses",
  yield: "View Navi pools, deposit, withdraw, and compare APYs",
  rebalancing: "Build swap plans to match a target allocation",
  composite: "Combine steps like swap + deposit",
  triggers: "Schedule or automate approved actions",
};

const CAPABILITY_APPROVAL_NOTES: Record<string, string> = {
  "portfolio-analysis": "Portfolio reads are informational — no on-chain approval needed.",
  swap: "Swaps are never executed until you approve the proposal card.",
  send: "Sends require explicit approval on the send proposal card.",
  yield: "Deposits and withdrawals each need approval on a Navi proposal card.",
  rebalancing: "Rebalance swap legs are prepared for your review — approve before execution.",
  composite: "Composite flows show all steps on one card; approve once (or per stage as shown).",
  triggers: "Triggers are saved only after you approve limits on the trigger proposal card.",
};

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Attach package action names from manifests so docs stay aligned with runtime (main + renderer). */
export function enrichAssistantToolsWithPackageActions(tools: AssistantTool[] = ASSISTANT_TOOLS): AssistantTool[] {
  return tools.map((tool) => ({
    ...tool,
    packageActions: packageActionsFromManifests(tool.packageIds),
  }));
}

export function getEnrichedAssistantTools(): AssistantTool[] {
  return enrichAssistantToolsWithPackageActions();
}

/**
 * Compact block injected into Assistant wallet context so the model knows real capabilities.
 */
export function buildAssistantCapabilitiesContextBlock(): string {
  const tools = getEnrichedAssistantTools();
  const lines: string[] = ["[AVAILABLE_TOOLS]"];
  for (const tool of tools) {
    const actions =
      tool.packageActions?.length ? tool.packageActions.map((a) => a.replace(/^core\./, "")).join(", ") : "—";
    lines.push(
      `${tool.title}: ${tool.shortDescription} Actions: ${actions}. Examples: ${tool.examples.slice(0, 2).join(" | ")}`,
    );
  }
  lines.push(
    "[/AVAILABLE_TOOLS]",
    "RULE: Only describe capabilities listed above. Never claim features outside these tools. Execution always requires user approval on proposal cards.",
  );
  return lines.join("\n");
}

const OVERVIEW_PATTERNS: RegExp[] = [
  /\bwhat can you do\b/,
  /\bwhat do you do\b/,
  /\bwhat tools do you have\b/,
  /\bwhat are you capable of\b/,
  /\bhow can you help(?:\s+me)?\b/,
  /\bwhat can this assistant do\b/,
  /\blist your (?:tools|capabilities|features)\b/,
  /\bwhat features\b.*\b(?:have|support)\b/,
];

const HOW_WORKS_PATTERNS: RegExp[] = [
  /\bhow does (?:this|destrall|the assistant) work\b/,
  /\bhow do you work\b/,
  /\bhow does dest?rall work\b/,
];

const TOOL_QUESTION_PATTERNS: { toolId: string; patterns: RegExp[] }[] = [
  {
    toolId: "swap",
    patterns: [
      /\bhow do(?:es)? swaps? work\b/,
      /\bhow (?:to|do i) swap\b/,
      /\bexplain swaps?\b/,
      /\bwhat (?:is|are) (?:a )?swaps?\b/,
    ],
  },
  {
    toolId: "yield",
    patterns: [
      /\bhow do(?:es)? yield work\b/,
      /\bhow (?:to|do i) (?:deposit|withdraw).*\b(?:yield|navi|pool)\b/,
      /\bhow (?:to|do i) see (?:available )?pools\b/,
      /\bhow do(?:es)? navi work\b/,
      /\bexplain yield\b/,
      /\bwhat (?:is|are) (?:yield|navi) pools?\b/,
    ],
  },
  {
    toolId: "triggers",
    patterns: [/\bhow do(?:es)? triggers? work\b/, /\bexplain triggers?\b/, /\bwhat (?:is|are) triggers?\b/],
  },
  {
    toolId: "scheduled-actions",
    patterns: [/\bhow do(?:es)? schedul(?:e|ed|ing) work\b/, /\bscheduled actions?\b/],
  },
  {
    toolId: "rebalancing",
    patterns: [
      /\bhow do(?:es)? rebalanc(?:e|ing) work\b/,
      /\bhow (?:to|do i) rebalance\b/,
      /\bexplain rebalanc\b/,
    ],
  },
  {
    toolId: "composite",
    patterns: [/\bhow do(?:es)? composite\b/, /\bswap.*deposit\b.*\bhow\b/, /\bhow.*swap.*deposit\b/],
  },
  {
    toolId: "portfolio-analysis",
    patterns: [/\bhow do you analyze\b/, /\bportfolio analysis\b/],
  },
  {
    toolId: "transaction-proposals",
    patterns: [/\bhow do proposals? work\b/, /\bwhat (?:is|are) proposal cards?\b/],
  },
];

/**
 * Detect educational / capability questions that should be answered deterministically from the registry.
 */
export function matchCapabilityHelpIntent(userText: string): CapabilityHelpMatch | null {
  const lower = normalize(userText);
  if (!lower || lower.length > 400) return null;

  for (const { toolId, patterns } of TOOL_QUESTION_PATTERNS) {
    if (patterns.some((p) => p.test(lower))) {
      return { kind: "tool", toolId };
    }
  }

  if (OVERVIEW_PATTERNS.some((p) => p.test(lower)) || HOW_WORKS_PATTERNS.some((p) => p.test(lower))) {
    return { kind: "overview" };
  }

  for (const tool of listAssistantTools()) {
    const hit = tool.assistantKeywords.some((kw) => {
      if (kw.length < 4) return false;
      return (
        lower.includes(`how does ${kw}`) ||
        lower.includes(`how do ${kw}`) ||
        lower.includes(`what is ${kw}`) ||
        lower.includes(`explain ${kw}`)
      );
    });
    if (hit) return { kind: "tool", toolId: tool.id };
  }

  return null;
}

function capabilityTitle(tool: AssistantTool): string {
  if (tool.id === "portfolio-analysis") return "Portfolio";
  if (tool.id === "rebalancing") return "Rebalance";
  if (tool.id === "composite") return "Composite actions";
  return tool.title;
}

function toolToCapabilityRow(tool: AssistantTool): AssistantCapabilitiesResult["tools"][number] {
  return {
    id: tool.id,
    title: capabilityTitle(tool),
    tagline: CAPABILITY_TAGLINES[tool.id] ?? tool.shortDescription,
    description: tool.longDescription,
    examples: tool.examples.slice(0, 4),
    approvalNote: CAPABILITY_APPROVAL_NOTES[tool.id] ?? "Actions require your approval on a proposal card.",
    risks: tool.risks.slice(0, 4),
  };
}

/** Structured payload for the in-chat capabilities card (from centralized registry). */
export function buildAssistantCapabilitiesStructuredResult(options?: {
  highlightToolId?: string;
}): AssistantCapabilitiesResult {
  const byId = new Map(getEnrichedAssistantTools().map((t) => [t.id, t]));
  const tools = CAPABILITY_CARD_TOOL_IDS.map((id) => {
    const tool = byId.get(id);
    if (!tool) return null;
    return toolToCapabilityRow(tool);
  }).filter((t): t is AssistantCapabilitiesResult["tools"][number] => t != null);

  return {
    type: "assistant_capabilities",
    title: "Here's what I can help with",
    subtitle:
      "I can analyze your portfolio, prepare transactions, and automate actions — always with your approval.",
    tools,
    highlightToolId: options?.highlightToolId,
  };
}

/** Short caption when returning a capabilities card (no text wall). */
export function buildCapabilityHelpCaption(match: CapabilityHelpMatch): string {
  if (match.kind === "overview") {
    return "Here are the main things I can help you do.";
  }
  const tool = getAssistantTool(match.toolId);
  if (!tool) return "Here are the main things I can help you do.";
  return `Here’s how ${capabilityTitle(tool)} works — expand the row on the card below.`;
}

/** Search tools for the Assistant Tools page filter. */
export function searchAssistantTools(query: string, tools: AssistantTool[] = getEnrichedAssistantTools()): AssistantTool[] {
  const q = normalize(query);
  if (!q) return tools;
  return tools.filter((tool) => {
    const haystack = [
      tool.title,
      tool.category,
      tool.shortDescription,
      tool.longDescription,
      ...tool.examples,
      ...tool.workflows,
      ...tool.risks,
      ...tool.assistantKeywords,
      ...(tool.packageActions ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return q.split(" ").every((term) => haystack.includes(term));
  });
}
