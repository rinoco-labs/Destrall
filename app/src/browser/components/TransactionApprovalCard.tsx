import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { categoryLabel } from "../transaction-inspector/transactionInspector";
import type { TransactionApprovalView } from "../transaction-inspector/transactionDisplay.types";
import { formatAddress } from "../transaction-inspector/transactionFormatter";
import { AlertTriangle, Copy, Check, X } from "lucide-react";
import { ApprovalModalFrame } from "./ApprovalModalFrame";

export type TransactionApprovalCardProps = {
  view: TransactionApprovalView;
  onApprove: () => void;
  onReject: () => void;
  busy?: boolean;
  simulating?: boolean;
};

function severityClass(severity: "info" | "warning" | "critical"): string {
  if (severity === "critical") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (severity === "warning") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-border bg-secondary/40 text-muted-foreground";
}

function CopyAddressButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-secondary/60"
      onClick={() => {
        void navigator.clipboard.writeText(address).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {formatAddress(address)}
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function AssetList({ title, items }: { title: string; items: TransactionApprovalView["youSend"] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li
            key={`${item.symbol}-${i}`}
            className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2 text-sm"
          >
            <span className="font-medium">{item.amount}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const MAX_VISIBLE_STEPS = 3;

export function TransactionApprovalCard({
  view,
  onApprove,
  onReject,
  busy,
  simulating,
}: TransactionApprovalCardProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const visibleSteps =
    stepsExpanded || view.steps.length <= MAX_VISIBLE_STEPS
      ? view.steps
      : view.steps.slice(0, MAX_VISIBLE_STEPS);
  const hiddenStepCount = view.steps.length - visibleSteps.length;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <ApprovalModalFrame
      className="h-full min-h-0"
      header={
        <div className="flex items-start gap-3">
          {view.dapp.faviconUrl ? (
            <img
              src={view.dapp.faviconUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded-lg border border-border bg-secondary/40"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {categoryLabel(view.category)}
            </p>
            <h2 id="dapp-approval-title" className="text-lg font-semibold leading-tight">
              {view.title}
            </h2>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{view.dapp.displayName}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{view.dapp.origin}</p>
          </div>
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary/60 disabled:opacity-50"
            aria-label="Close and reject"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      }
      footer={
        <div className="flex gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            className="min-h-11 flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary/60 disabled:opacity-50 sm:flex-none sm:min-h-0"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className="min-h-11 flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 sm:flex-none sm:min-h-0"
          >
            {busy ? "Working…" : "Approve"}
          </button>
        </div>
      }
    >
      <section className="space-y-1">
        <p className="text-base font-medium leading-snug">{view.headline}</p>
        {view.subheadline ? (
          <p className="text-sm text-muted-foreground">{view.subheadline}</p>
        ) : null}
        {simulating ? (
          <p className="text-xs text-muted-foreground">Simulating transaction…</p>
        ) : null}
      </section>

      {view.messagePreview ? (
        <section className="rounded-lg border border-border bg-secondary/30 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Message
          </p>
          <p className="whitespace-pre-wrap break-words text-sm">{view.messagePreview}</p>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Account</p>
          <p className="truncate font-medium">{view.accountLabel}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Network</p>
          <p className="truncate font-medium">{view.networkLabel}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Your address</p>
          <CopyAddressButton address={view.accountAddress} />
        </div>
      </section>

      {(view.youSend.length > 0 || view.youReceive.length > 0) && (
        <section className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Asset movements
          </p>
          <AssetList title="You send" items={view.youSend} />
          <AssetList title="You receive" items={view.youReceive} />
        </section>
      )}

      {view.steps.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Transaction steps ({view.steps.length})
            </p>
            {view.steps.length > MAX_VISIBLE_STEPS ? (
              <button
                type="button"
                className="shrink-0 text-xs text-primary underline"
                onClick={() => setStepsExpanded((v) => !v)}
              >
                {stepsExpanded ? "Show less" : `Show all ${view.steps.length}`}
              </button>
            ) : null}
          </div>
          <ol className="space-y-2">
            {visibleSteps.map((step) => (
              <li
                key={step.index}
                className="rounded-lg border border-border bg-secondary/20 px-3 py-2 text-sm"
              >
                <p className="font-medium">
                  {step.index}. {step.title}
                </p>
                {step.detail ? (
                  <p className="mt-0.5 break-words text-xs text-muted-foreground">{step.detail}</p>
                ) : null}
              </li>
            ))}
          </ol>
          {hiddenStepCount > 0 && !stepsExpanded ? (
            <p className="text-xs text-muted-foreground">
              + {hiddenStepCount} more step{hiddenStepCount === 1 ? "" : "s"} (collapsed)
            </p>
          ) : null}
        </section>
      )}

      {view.fees.length > 0 && (
        <section className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fees</p>
          {view.fees.map((fee) => (
            <div
              key={fee.label}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">{fee.label}</span>
              <span className="font-medium">{fee.amount}</span>
            </div>
          ))}
        </section>
      )}

      {view.warnings.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Warnings</p>
          {view.warnings.map((w) => (
            <div
              key={w.id}
              className={`flex gap-2 rounded-lg border px-3 py-2 text-sm ${severityClass(w.severity)}`}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">{w.title}</p>
                <p className="mt-0.5 text-xs opacity-90">{w.description}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      <Accordion type="single" collapsible>
        <AccordionItem value="advanced" className="border-none">
          <AccordionTrigger className="py-2 text-sm">Advanced details</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              <button
                type="button"
                className="text-xs text-muted-foreground underline"
                onClick={() => setAdvancedOpen((v) => !v)}
              >
                {advancedOpen ? "Hide" : "Show"} raw payload
              </button>
              {advancedOpen ? (
                <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-black/40 p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap break-all">
                  {view.advancedPayload}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Raw request data is hidden by default. Expand only if you need to debug.
                </p>
              )}
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => void navigator.clipboard.writeText(view.advancedPayload)}
              >
                <Copy className="h-3 w-3" /> Copy payload
              </button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </ApprovalModalFrame>
    </div>
  );
}
