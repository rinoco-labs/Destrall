import { CRITICAL_FLOW_BLOCKED_MESSAGE, type CriticalFlowType } from "../../../shared/criticalFlows";

class CriticalFlowService {
  private readonly active = new Map<CriticalFlowType, number>();

  register(flow: CriticalFlowType): void {
    this.active.set(flow, (this.active.get(flow) ?? 0) + 1);
  }

  unregister(flow: CriticalFlowType): void {
    const count = this.active.get(flow) ?? 0;
    if (count <= 1) {
      this.active.delete(flow);
      return;
    }
    this.active.set(flow, count - 1);
  }

  isActive(): boolean {
    return this.active.size > 0;
  }

  activeFlows(): CriticalFlowType[] {
    return [...this.active.keys()];
  }

  assertCanOpenInstaller(): void {
    if (this.isActive()) {
      throw new Error(CRITICAL_FLOW_BLOCKED_MESSAGE);
    }
  }
}

export const criticalFlowService = new CriticalFlowService();
