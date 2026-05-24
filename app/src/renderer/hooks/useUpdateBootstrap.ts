import { useEffect } from "react";
import { subscribeUpdateStatus } from "@/lib/desktopUpdates";
import { isDestrallDesktop } from "@/lib/desktopWallet";
import { useUpdateStore } from "@/stores/updateStore";

export function useUpdateBootstrap(): void {
  const setStatus = useUpdateStore((s) => s.setStatus);
  const refreshStatus = useUpdateStore((s) => s.refreshStatus);
  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates);

  useEffect(() => {
    if (!isDestrallDesktop()) return;
    const unsubscribe = subscribeUpdateStatus(setStatus);
    void refreshStatus();
    void checkForUpdates();
    return unsubscribe;
  }, [setStatus, refreshStatus, checkForUpdates]);
}
