import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { PendingDappRequest } from "../stores/dappConnectionStore";
import { useTransactionInspection } from "../hooks/useTransactionInspection";
import { TransactionApprovalCard } from "./TransactionApprovalCard";

export type DappApprovalModalProps = {
  request: PendingDappRequest;
  accountId?: string;
  accountLabel: string;
  accountAddress: string;
  networkLabel: string;
  onApprove: () => void;
  onReject: () => void;
  busy?: boolean;
};

/** Explicit height cap — max-height alone lets the box grow with content (see debug logs). */
const MODAL_SHELL_STYLE: CSSProperties = {
  height: "min(90vh, calc(100vh - 2rem))",
  maxHeight: "min(90vh, calc(100vh - 2rem))",
};

export function DappApprovalModal({
  request,
  accountId,
  accountLabel,
  accountAddress,
  networkLabel,
  onApprove,
  onReject,
  busy,
}: DappApprovalModalProps) {
  const { view, simulating } = useTransactionInspection({
    request,
    accountId,
    accountLabel,
    accountAddress,
    networkLabel,
  });

  const modal = (
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dapp-approval-title"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />
      {view ? (
        <div
          className="pointer-events-auto relative z-10 flex w-full min-h-0 max-w-lg flex-col overflow-hidden rounded-t-xl sm:rounded-xl"
          style={MODAL_SHELL_STYLE}
        >
          <TransactionApprovalCard
            view={view}
            onApprove={onApprove}
            onReject={onReject}
            busy={busy}
            simulating={simulating}
          />
        </div>
      ) : null}
    </div>
  );

  return createPortal(modal, document.body);
}
