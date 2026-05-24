import type { ReactNode } from "react";
import type { CriticalFlowType } from "../../shared/criticalFlows";
import { useCriticalFlow } from "@/hooks/useCriticalFlow";

export function CriticalFlowScope({
  flow,
  active,
  children,
}: {
  flow: CriticalFlowType;
  active: boolean;
  children?: ReactNode;
}) {
  useCriticalFlow(flow, active);
  return children ?? null;
}
