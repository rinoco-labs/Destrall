import { Sparkles } from "lucide-react";
import { ASSISTANT_STARTER_PROMPTS } from "../../../assistant/knowledge/assistant-tools.docs";

type Props = {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
};

export function AssistantStarterChips({ onSelect, disabled }: Props) {
  return (
    <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto px-1">
      {ASSISTANT_STARTER_PROMPTS.map(({ label, prompt }) => (
        <button
          key={prompt}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-card/80 backdrop-blur-sm px-3.5 py-2 text-xs font-medium text-foreground shadow-sm hover:bg-primary/10 hover:border-primary/40 transition disabled:opacity-50 disabled:pointer-events-none"
        >
          {label === "What can you do?" ? <Sparkles className="w-3.5 h-3.5 text-brand shrink-0" /> : null}
          {label}
        </button>
      ))}
    </div>
  );
}

export function AssistantEmptyState({
  onSelectPrompt,
  disabled,
}: {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center min-h-[min(420px,50vh)]">
      <div
        className="w-14 h-14 rounded-2xl border border-brand/30 bg-brand/10 text-brand flex items-center justify-center mb-5"
        style={{
          background:
            "linear-gradient(145deg, color-mix(in oklab, var(--brand) 18%, transparent), transparent)",
        }}
      >
        <Sparkles className="w-7 h-7" />
      </div>
      <h2 className="text-lg font-semibold text-foreground tracking-tight">Ask your portfolio assistant</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm leading-relaxed">
        Analyze your wallet, compare APYs, prepare swaps, or create triggers — always with your approval.
      </p>
      <div className="mt-8 w-full">
        <AssistantStarterChips onSelect={onSelectPrompt} disabled={disabled} />
      </div>
    </div>
  );
}
