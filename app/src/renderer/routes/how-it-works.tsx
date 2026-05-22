import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquareText, ShieldCheck } from "lucide-react";
import { AppLogo } from "@/components/branding/AppLogo";
import { AppShell } from "@/components/app-shell";
import { HelpPageHeader } from "@/components/help/HelpPageHeader";
import { WorkflowFlowCard } from "@/components/help/WorkflowFlowCard";
import { HOW_IT_WORKS_SECTIONS, ASSISTANT_OVERVIEW_BLURB } from "../../assistant/knowledge/assistant-tools.docs";
import { STANDARD_ASSISTANT_FLOW } from "../../assistant/knowledge/assistant-workflows";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorksPage,
  head: () => ({
    meta: [
      { title: "How It Works — Destrall" },
      {
        name: "description",
        content: "Learn how Destrall Assistant, proposals, and automation keep you in control.",
      },
    ],
  }),
});

function HowItWorksPage() {
  return (
    <AppShell active="settings">
      <div className="max-w-3xl mx-auto w-full px-2 pb-16">
        <HelpPageHeader
          title="How It Works"
          subtitle="Destrall is proposal-first: the Assistant analyzes your wallet, prepares actions, and you approve every on-chain step."
          extra={
            <Link
              to="/assistant-tools"
              className="text-sm font-medium text-brand hover:underline shrink-0"
            >
              Browse all tools →
            </Link>
          }
        />

        <p className="text-sm text-muted-foreground leading-relaxed mb-6">{ASSISTANT_OVERVIEW_BLURB}</p>

        <WorkflowFlowCard steps={STANDARD_ASSISTANT_FLOW} className="mb-8" />

        <Accordion type="multiple" defaultValue={["assistant", "approvals"]} className="space-y-3 mb-10">
          {HOW_IT_WORKS_SECTIONS.map((section) => (
            <AccordionItem
              key={section.id}
              value={section.id}
              className="rounded-2xl border border-border/80 bg-card/40 backdrop-blur px-4 border-b-0"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="font-semibold text-left">{section.title}</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-3">
                <p className="text-sm text-muted-foreground">{section.summary}</p>
                <ul className="text-sm text-foreground/90 space-y-2 list-disc list-inside">
                  {section.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            to="/assistant"
            search={{ prompt: "What can you do?" }}
            className="rounded-2xl border border-border bg-card/50 p-5 hover:bg-secondary/30 transition group"
          >
            <MessageSquareText className="w-6 h-6 text-brand mb-3" />
            <p className="font-semibold">Ask the Assistant</p>
            <p className="text-sm text-muted-foreground mt-1">Try “What can you do?” in chat</p>
          </Link>
          <Link
            to="/assistant-tools"
            className="rounded-2xl border border-border bg-card/50 p-5 hover:bg-secondary/30 transition"
          >
            <AppLogo variant="mark" size="md" className="mb-3" />
            <p className="font-semibold">Assistant Tools</p>
            <p className="text-sm text-muted-foreground mt-1">Detailed guides, examples, and risks</p>
          </Link>
        </div>

        <div className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Destrall never asks for your seed phrase. The Assistant cannot sign transactions — only your wallet can,
            after you approve a proposal card.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
