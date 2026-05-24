import { useEffect } from "react";
import type { CriticalFlowType } from "../../shared/criticalFlows";
import { desktopCriticalFlowRegister, desktopCriticalFlowUnregister } from "@/lib/desktopUpdates";
import { isDestrallDesktop } from "@/lib/desktopWallet";

export function useCriticalFlow(flow: CriticalFlowType, active: boolean): void {
  useEffect(() => {
    if (!isDestrallDesktop() || !active) return;
    void desktopCriticalFlowRegister(flow).catch(() => undefined);
    return () => {
      void desktopCriticalFlowUnregister(flow).catch(() => undefined);
    };
  }, [flow, active]);
}
