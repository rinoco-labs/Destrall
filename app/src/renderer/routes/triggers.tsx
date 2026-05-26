import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useWalletStore } from "@/stores/walletStore";
import { resolveTriggersAccountId } from "../../shared/triggers/resolveTriggersAccountId";
import {
  desktopTriggersDelete,
  desktopTriggersExecutions,
  desktopTriggersList,
  desktopTriggersPause,
  desktopTriggersResume,
} from "@/lib/desktopTriggers";
import type { TriggerExecutionRecord, TriggerRecord } from "@packages/core/triggers/triggers.types";
import {
  formatTriggerNextCheckLabel,
  formatTriggerRecurrenceLabel,
} from "@services/time/trigger-schedule-display";
import { formatTriggerDate, summarizeTriggerForList } from "@/lib/triggerDisplay";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/triggers")({
  component: TriggersPage,
  head: () => ({
    meta: [{ title: "Triggers — Destrall" }],
  }),
});

type PendingAction = { triggerId: string; kind: "pause" | "resume" | "delete" } | null;

function TriggersPage() {
  const activeAccountId = useWalletStore((s) => s.activeAccountId);
  const accounts = useWalletStore((s) => s.accounts);
  const accountId = useMemo(
    () => resolveTriggersAccountId(activeAccountId, accounts),
    [activeAccountId, accounts],
  );

  const [rows, setRows] = useState<TriggerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [executions, setExecutions] = useState<TriggerExecutionRecord[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [deleteTarget, setDeleteTarget] = useState<TriggerRecord | null>(null);

  const reload = useCallback(async () => {
    if (!accountId) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await desktopTriggersList(accountId));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load triggers";
      setError(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    setSelectedId(null);
    setExecutions([]);
    void reload();
  }, [reload]);

  const loadExecutions = async (id: string) => {
    if (!accountId) return;
    try {
      setSelectedId(id);
      setExecutions(await desktopTriggersExecutions(accountId, id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load trigger history");
    }
  };

  const runStatusAction = async (triggerId: string, kind: "pause" | "resume") => {
    if (!accountId) return;
    setPendingAction({ triggerId, kind });
    try {
      if (kind === "pause") {
        await desktopTriggersPause(accountId, triggerId);
      } else {
        await desktopTriggersResume(accountId, triggerId);
      }
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Could not ${kind} trigger`);
    } finally {
      setPendingAction(null);
    }
  };

  const confirmDelete = async () => {
    if (!accountId || !deleteTarget) return;
    const triggerId = deleteTarget.id;
    setPendingAction({ triggerId, kind: "delete" });
    try {
      await desktopTriggersDelete(accountId, triggerId);
      setDeleteTarget(null);
      if (selectedId === triggerId) {
        setSelectedId(null);
        setExecutions([]);
      }
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete trigger");
    } finally {
      setPendingAction(null);
    }
  };

  const isRowBusy = (triggerId: string) => pendingAction?.triggerId === triggerId;

  return (
    <AppShell active="settings">
      <div className="px-5 pb-8 space-y-4">
        <h1 className="text-lg font-semibold">Triggers</h1>
        <p className="text-sm text-muted-foreground">
          Pre-approved automation for this account. Runs while the app is open — not when fully closed.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/assistant">Create via Assistant</Link>
        </Button>

        {!accountId ? (
          <p className="text-sm text-muted-foreground">Unlock your wallet to view triggers.</p>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No triggers yet.
            <br />
            Create a trigger from the assistant or trigger builder to automate wallet actions.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((t) => {
              const recurrence = formatTriggerRecurrenceLabel(t);
              const nextRun = formatTriggerNextCheckLabel(t);
              const display = summarizeTriggerForList(t);
              const busy = isRowBusy(t.id);
              const pausing = busy && pendingAction?.kind === "pause";
              const resuming = busy && pendingAction?.kind === "resume";
              const deleting = busy && pendingAction?.kind === "delete";

              return (
                <li key={t.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {display.actionTypeLabel} · {t.status}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1 shrink-0 justify-end">
                      {t.status === "active" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => void runStatusAction(t.id, "pause")}
                        >
                          {pausing ? <Loader2 className="w-3 h-3 animate-spin" /> : "Pause"}
                        </Button>
                      )}
                      {t.status === "paused" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => void runStatusAction(t.id, "resume")}
                        >
                          {resuming ? <Loader2 className="w-3 h-3 animate-spin" /> : "Resume"}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void loadExecutions(t.id)}
                      >
                        History
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={busy}
                        onClick={() => setDeleteTarget(t)}
                      >
                        {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{display.conditionSummary}</p>
                  <p className="text-xs text-muted-foreground">{display.actionSummary}</p>
                  {display.assetLabel && (
                    <p className="text-xs text-muted-foreground">Asset: {display.assetLabel}</p>
                  )}
                  {recurrence && <p className="text-xs text-muted-foreground">{recurrence}</p>}
                  {nextRun && (
                    <p className="text-xs">
                      <span className="text-muted-foreground">Next execution: </span>
                      {nextRun}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Created {formatTriggerDate(t.createdAt) ?? "—"}
                    {t.lastCheckedAt ? ` · Last checked ${formatTriggerDate(t.lastCheckedAt)}` : ""}
                    {t.lastTriggeredAt ? ` · Last run ${formatTriggerDate(t.lastTriggeredAt)}` : ""}
                  </p>
                  {selectedId === t.id && executions.length > 0 && (
                    <ul className="text-xs space-y-1 border-t border-border pt-2">
                      {executions.map((e) => (
                        <li key={e.id}>
                          {e.status} · {new Date(e.executedAt).toLocaleString()}
                          {e.txDigest ? ` · ${e.txDigest.slice(0, 10)}…` : ""}
                          {e.error ? ` · ${e.error}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !pendingAction) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this trigger?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the trigger and it will no longer run.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingAction?.kind === "delete"}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pendingAction?.kind === "delete"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {pendingAction?.kind === "delete" ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
