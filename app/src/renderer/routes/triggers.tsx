import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useWalletStore } from "@/stores/walletStore";
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
} from "../../services/time/trigger-schedule-display";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/triggers")({
  component: TriggersPage,
  head: () => ({
    meta: [{ title: "Triggers — Destrall" }],
  }),
});

function TriggersPage() {
  const activeAccountId = useWalletStore((s) => s.activeAccountId);
  const [rows, setRows] = useState<TriggerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [executions, setExecutions] = useState<TriggerExecutionRecord[]>([]);

  const reload = useCallback(async () => {
    if (!activeAccountId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(await desktopTriggersList(activeAccountId));
    } finally {
      setLoading(false);
    }
  }, [activeAccountId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadExecutions = async (id: string) => {
    if (!activeAccountId) return;
    setSelectedId(id);
    setExecutions(await desktopTriggersExecutions(activeAccountId, id));
  };

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

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No triggers yet.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((t) => {
              const recurrence = formatTriggerRecurrenceLabel(t);
              const nextRun = formatTriggerNextCheckLabel(t);
              return (
              <li key={t.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {t.type} · {t.status}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 shrink-0 justify-end">
                    {t.status === "active" && (
                      <Button variant="ghost" size="sm" onClick={() => void desktopTriggersPause(activeAccountId!, t.id).then(reload)}>
                        Pause
                      </Button>
                    )}
                    {t.status === "paused" && (
                      <Button variant="ghost" size="sm" onClick={() => void desktopTriggersResume(activeAccountId!, t.id).then(reload)}>
                        Start
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => void loadExecutions(t.id)}>
                      History
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => void desktopTriggersDelete(activeAccountId!, t.id).then(reload)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{t.description}</p>
                {recurrence && <p className="text-xs text-muted-foreground">{recurrence}</p>}
                {nextRun && (
                  <p className="text-xs">
                    <span className="text-muted-foreground">Next execution: </span>
                    {nextRun}
                  </p>
                )}
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
    </AppShell>
  );
}
