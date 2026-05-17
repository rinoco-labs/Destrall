import { useEffect, useMemo, useState } from "react";
import type { PendingDappRequest } from "../stores/dappConnectionStore";
import { inspectApprovalRequest } from "../transaction-inspector/transactionInspector";
import type { TransactionApprovalView } from "../transaction-inspector/transactionDisplay.types";
import { desktopBrowserPreviewTransaction } from "../../renderer/lib/desktopBrowser";

export function useTransactionInspection(params: {
  request: PendingDappRequest | null;
  accountLabel: string;
  accountAddress: string;
  networkLabel: string;
  accountId?: string;
}) {
  const { request, accountLabel, accountAddress, networkLabel, accountId } = params;
  const [simulation, setSimulation] = useState<TransactionApprovalView["simulation"]>();
  const [simulating, setSimulating] = useState(false);

  const baseInput = useMemo(() => {
    if (!request) return null;
    return {
      method: request.method,
      origin: request.origin,
      payload: request.payload,
      accountLabel,
      accountAddress,
      networkLabel,
    };
  }, [accountAddress, accountLabel, networkLabel, request]);

  useEffect(() => {
    if (!request || !accountId) {
      setSimulation(undefined);
      return;
    }

    const isTx =
      request.method === "sui:signTransaction" || request.method === "sui:signAndExecuteTransaction";
    if (!isTx) {
      setSimulation(undefined);
      return;
    }

    const payload = request.payload as Record<string, unknown> | undefined;
    const txDataJson = typeof payload?.txData === "string" ? payload.txData : "";
    if (!txDataJson) return;

    let cancelled = false;
    setSimulating(true);
    void desktopBrowserPreviewTransaction({ accountId, txDataJson })
      .then((result) => {
        if (cancelled) return;
        setSimulation({
          ok: result.ok,
          gasEstimate: result.gasEstimate,
          errorMessage: result.errorMessage,
          balanceChanges: result.balanceChanges,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        const raw = error instanceof Error ? error.message : "Simulation failed";
        const errorMessage = raw.includes("No handler registered")
          ? "Gas preview unavailable. Restart Destrall to load the latest build."
          : raw.includes("Error invoking remote method")
            ? "Gas preview unavailable for this transaction."
            : raw;
        setSimulation({
          ok: false,
          errorMessage,
        });
      })
      .finally(() => {
        if (!cancelled) setSimulating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, request]);

  const view: TransactionApprovalView | null = useMemo(() => {
    if (!baseInput) return null;
    return inspectApprovalRequest(baseInput, { simulation });
  }, [baseInput, simulation]);

  return { view, simulating };
}
