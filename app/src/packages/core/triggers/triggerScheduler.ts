import { BrowserWindow } from "electron";
import { walletService } from "../../../main/wallet/walletService";
import { triggerStorageService } from "./triggerStorageService";
import { executeTriggerIfDue } from "./triggerExecutor";

/**
 * Phase 1 in-app trigger poller.
 *
 * Runs while the Electron app is open (and on foreground). Checks due triggers on an interval.
 * Also runs once when a window is shown (foreground).
 *
 * For reliable always-on execution when the app is fully killed, a future server-side keeper
 * or push/background infrastructure is required. Do not assume mobile/desktop cron while killed.
 */

const POLL_INTERVAL_MS = 60_000;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let running = false;

async function pollOnce(accountId?: string): Promise<void> {
  if (running) return;
  running = true;
  try {
    const nowIso = new Date().toISOString();
    const activeId = accountId ?? walletService.getStatus().activeAccountId ?? undefined;
    const due = triggerStorageService.listDue(nowIso, activeId);
    for (const record of due) {
      if (record.status !== "active") continue;
      try {
        await executeTriggerIfDue(record);
      } catch (e) {
        console.warn(
          "[trigger-scheduler] execution error",
          record.id,
          e instanceof Error ? e.message : e,
        );
      }
    }
  } finally {
    running = false;
  }
}

export function startTriggerScheduler(): void {
  if (intervalHandle) return;
  void pollOnce();
  intervalHandle = setInterval(() => {
    void pollOnce();
  }, POLL_INTERVAL_MS);

  for (const win of BrowserWindow.getAllWindows()) {
    win.on("focus", () => {
      void pollOnce();
    });
    win.on("show", () => {
      void pollOnce();
    });
  }

  console.info("[trigger-scheduler] Started (in-app polling only)");
}

export function stopTriggerScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

/** Manual tick (e.g. after approving a trigger). */
export function runTriggerSchedulerNow(accountId?: string): void {
  void pollOnce(accountId);
}
