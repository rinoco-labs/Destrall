import { useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  Layers,
  PieChart,
  Send,
  Sparkles,
  Sprout,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AssistantCapabilitiesResult } from "../../../assistant/assistantResultTypes";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AppLogo } from "@/components/branding/AppLogo";

const TOOL_ICONS: Record<string, LucideIcon> = {
  "portfolio-analysis": PieChart,
  swap: ArrowLeftRight,
  send: Send,
  yield: Sprout,
  rebalancing: PieChart,
  composite: Layers,
  triggers: Zap,
};

type Props = {
  payload: AssistantCapabilitiesResult;
  onTryPrompt?: (prompt: string) => void;
};

export function AssistantCapabilitiesCard({ payload, onTryPrompt }: Props) {
  const [openId, setOpenId] = useState<string | null>(payload.highlightToolId ?? null);

  return (
    <div className="flex justify-start w-full">
      <div
        className="w-full max-w-lg rounded-2xl border border-brand/30 bg-card/60 overflow-hidden"
        style={{
          background:
            "linear-gradient(165deg, color-mix(in oklab, var(--brand) 10%, var(--card)) 0%, var(--card) 58%)",
        }}
      >
        <div className="flex items-start gap-3 p-4 border-b border-border/50">
          <div className="w-10 h-10 rounded-xl border border-brand/35 bg-brand/10 flex items-center justify-center shrink-0 p-1.5">
            <AppLogo variant="mark" size="sm" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold tracking-[0.18em] text-brand uppercase">Assistant</p>
            <h3 className="text-base font-semibold text-foreground leading-snug">{payload.title}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{payload.subtitle}</p>
          </div>
        </div>

        <ul className="divide-y divide-border/40">
          {payload.tools.map((tool) => {
            const Icon = TOOL_ICONS[tool.id] ?? Sparkles;
            const isOpen = openId === tool.id;
            return (
              <li key={tool.id}>
                <Collapsible open={isOpen} onOpenChange={(open) => setOpenId(open ? tool.id : null)}>
                  <CollapsibleTrigger className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-background/30 transition">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-brand flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{tool.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{tool.tagline}</p>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-0 space-y-3 border-t border-border/30 bg-background/20">
                      <p className="text-xs text-foreground/85 leading-relaxed">{tool.description}</p>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                          Examples
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {tool.examples.map((ex) =>
                            onTryPrompt ? (
                              <button
                                key={ex}
                                type="button"
                                onClick={() => onTryPrompt(ex)}
                                className="text-[11px] rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-foreground hover:bg-primary/15 transition"
                              >
                                {ex}
                              </button>
                            ) : (
                              <span
                                key={ex}
                                className="text-[11px] rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-muted-foreground"
                              >
                                {ex}
                              </span>
                            ),
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Approval
                        </p>
                        <p className="text-xs text-foreground/90">{tool.approvalNote}</p>
                      </div>

                      {tool.risks.length > 0 ? (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600/90 mb-1">
                            Notes
                          </p>
                          <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                            {tool.risks.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
