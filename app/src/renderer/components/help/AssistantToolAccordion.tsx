import { Link } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Send,
  Sprout,
  Layers,
  Zap,
  Timer,
  PieChart,
  Users,
  Sparkles,
  FileCheck,
  type LucideIcon,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { AssistantTool } from "../../../assistant/knowledge/assistant-tools.types";
import { STANDARD_ASSISTANT_FLOW, TRIGGER_MONITOR_FLOW } from "../../../assistant/knowledge/assistant-workflows";
import { WorkflowFlowCard } from "./WorkflowFlowCard";

const TOOL_ICONS: Record<string, LucideIcon> = {
  swap: ArrowLeftRight,
  send: Send,
  yield: Sprout,
  composite: Layers,
  triggers: Zap,
  "scheduled-actions": Timer,
  rebalancing: PieChart,
  "portfolio-analysis": PieChart,
  contacts: Users,
  "portfolio-insights": Sparkles,
  "transaction-proposals": FileCheck,
};

function flowForTool(toolId: string) {
  if (toolId === "triggers" || toolId === "scheduled-actions") return TRIGGER_MONITOR_FLOW;
  return STANDARD_ASSISTANT_FLOW;
}

type Props = {
  tools: AssistantTool[];
  openIds?: string[];
  onOpenChange?: (ids: string[]) => void;
};

export function AssistantToolAccordion({ tools, openIds, onOpenChange }: Props) {
  return (
    <Accordion type="multiple" value={openIds} onValueChange={onOpenChange} className="space-y-3">
      {tools.map((tool) => {
        const Icon = TOOL_ICONS[tool.id] ?? Sparkles;
        return (
          <AccordionItem
            key={tool.id}
            value={tool.id}
            className="rounded-2xl border border-border/80 bg-card/50 backdrop-blur-md px-4 overflow-hidden border-b-0 data-[state=open]:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.35)]"
            style={{
              backgroundImage:
                "linear-gradient(160deg, color-mix(in oklab, var(--brand) 6%, var(--card)) 0%, var(--card) 55%)",
            }}
          >
            <AccordionTrigger className="hover:no-underline py-4 gap-3">
              <div className="flex items-start gap-3 text-left flex-1 min-w-0">
                <div className="rounded-xl bg-primary/10 p-2 shrink-0">
                  <Icon className="w-5 h-5 text-brand" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{tool.title}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground rounded-full border border-border px-2 py-0.5">
                      {tool.category}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{tool.shortDescription}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-4">
              <WorkflowFlowCard steps={flowForTool(tool.id)} />

              <p className="text-sm text-foreground/90 leading-relaxed">{tool.longDescription}</p>

              {tool.packageActions && tool.packageActions.length > 0 && (
                <div className="rounded-lg border border-border/50 bg-background/30 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Package actions</p>
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    {tool.packageActions.join(" · ")}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-foreground mb-2">How to use it</p>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                  {tool.workflows.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ol>
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Example prompts</p>
                <div className="flex flex-wrap gap-2">
                  {tool.examples.map((ex) => (
                    <Link
                      key={ex}
                      to="/assistant"
                      search={{ prompt: ex }}
                      className="text-xs rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-foreground hover:bg-primary/15 transition"
                    >
                      {ex}
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2">Risks</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  {tool.risks.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
