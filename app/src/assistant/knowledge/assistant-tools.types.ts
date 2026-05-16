export type AssistantToolCategory =
  | "Trading"
  | "Transfers"
  | "Yield"
  | "Automation"
  | "Portfolio"
  | "Insights"
  | "System";

export type AssistantWorkflowStep = {
  label: string;
  detail?: string;
};

export type AssistantTool = {
  id: string;
  title: string;
  category: AssistantToolCategory;
  shortDescription: string;
  longDescription: string;
  examples: string[];
  workflows: string[];
  risks: string[];
  relatedTools: string[];
  assistantKeywords: string[];
  /** Package ids used to derive live action names from manifests. */
  packageIds: string[];
  /** Filled at runtime from {@link ActionRegistry} — do not author manually. */
  packageActions?: string[];
};

export type HowItWorksSection = {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
};

export type CapabilityHelpMatch =
  | { kind: "overview" }
  | { kind: "tool"; toolId: string };
