import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { HelpPageHeader } from "@/components/help/HelpPageHeader";
import { AssistantToolAccordion } from "@/components/help/AssistantToolAccordion";
import { toolsForAssistantToolsPage } from "../../assistant/knowledge/assistant-tools.docs";
import { getEnrichedAssistantTools, searchAssistantTools } from "../../assistant/knowledge/assistant-capabilities.service";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/assistant-tools")({
  component: AssistantToolsPage,
  head: () => ({
    meta: [
      { title: "Assistant Tools — Destrall" },
      {
        name: "description",
        content: "Searchable reference for swaps, yield, triggers, rebalancing, and more.",
      },
    ],
  }),
});

function AssistantToolsPage() {
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState<string[]>([]);

  const allTools = useMemo(() => {
    const ordered = toolsForAssistantToolsPage();
    const enriched = getEnrichedAssistantTools();
    const byId = new Map(enriched.map((t) => [t.id, t]));
    return ordered.map((t) => byId.get(t.id) ?? t);
  }, []);

  const filtered = useMemo(() => searchAssistantTools(query, allTools), [query, allTools]);

  const handleSearchChange = (value: string) => {
    setQuery(value);
    if (value.trim()) {
      setOpenIds(searchAssistantTools(value, allTools).map((t) => t.id));
    }
  };

  return (
    <AppShell active="settings">
      <div className="max-w-3xl mx-auto w-full px-2 pb-16">
        <HelpPageHeader
          title="Assistant Tools"
          subtitle="Everything the Assistant can prepare for you — with examples, workflows, risks, and live package action mapping."
          extra={
            <Link to="/how-it-works" className="text-sm font-medium text-brand hover:underline shrink-0">
              How it works →
            </Link>
          }
        />

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search swap, yield, trigger, rebalance, APY…"
            className="pl-10 rounded-xl bg-card/60 border-border/80"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No tools match your search.</p>
        ) : (
          <AssistantToolAccordion tools={filtered} openIds={openIds} onOpenChange={setOpenIds} />
        )}

        <p className="text-xs text-muted-foreground text-center mt-8">
          Tap an example prompt to open Assistant with it prefilled.
        </p>
      </div>
    </AppShell>
  );
}
