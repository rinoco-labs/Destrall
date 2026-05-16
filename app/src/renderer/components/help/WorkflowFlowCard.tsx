import { ArrowRight } from "lucide-react";
import type { AssistantWorkflowStep } from "../../../assistant/knowledge/assistant-tools.types";

export function WorkflowFlowCard({
  steps,
  className = "",
}: {
  steps: AssistantWorkflowStep[];
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border/60 bg-background/40 p-3 ${className}`}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Flow</p>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs">
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-center gap-1.5">
            {i > 0 && <ArrowRight className="w-3 h-3 text-muted-foreground/50 shrink-0" aria-hidden />}
            <span
              className="rounded-lg border border-primary/15 bg-primary/5 px-2 py-1 font-medium text-foreground"
              title={step.detail}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
