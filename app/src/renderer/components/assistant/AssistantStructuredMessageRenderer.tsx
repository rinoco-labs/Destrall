import { Fragment, useCallback, useEffect, useState } from "react";
import type {
  AssistantStructuredResult,
  SendProposalResult,
  SwapProposalResult,
  NaviDepositProposalResult,
  NaviWithdrawProposalResult,
} from "../../../assistant/assistantResultTypes";
import { isProposalStructuredResult } from "../../../assistant/assistantResultTypes";
import {
  patchStructuredProposal,
  serializeAssistantMessageMetadata,
} from "../../../assistant/assistantMessageMetadata";
import {
  ActionBubble,
  ProtocolBubble,
  StructuredErrorBubble,
  TransactionResultBubble,
  WalletBubble,
  type ChatActionBubbleMessage,
} from "./AssistantChatBubbles";
import { desktopConfirmTransfer } from "@/lib/desktopChain";
import { useWalletStore } from "@/stores/walletStore";

function proposalToActionMessage(
  messageId: string,
  p:
    | SendProposalResult
    | SwapProposalResult
    | NaviDepositProposalResult
    | NaviWithdrawProposalResult,
): ChatActionBubbleMessage {
  return {
    id: `${messageId}:${p.proposalId}`,
    kind: "action",
    status: p.status,
    title: p.card.title,
    label: p.card.label,
    source: p.card.source,
    flows: p.card.flows,
    details: p.card.details,
    note: p.card.note,
    digest: p.digest,
    errorMessage: p.errorMessage,
  };
}

export function AssistantStructuredMessageRenderer({
  accountId,
  chatId,
  messageId,
  initialMetadata,
  blocks: blocksProp,
  onUpdateMessage,
  onReloadThread,
}: {
  accountId: string;
  chatId: string;
  messageId: string;
  initialMetadata: string | null;
  blocks: AssistantStructuredResult[];
  onUpdateMessage: (metadata: string) => Promise<void>;
  onReloadThread: () => Promise<void>;
}) {
  const [meta, setMeta] = useState<string | null>(initialMetadata);
  const [blocks, setBlocks] = useState(blocksProp);

  useEffect(() => {
    setMeta(initialMetadata);
    setBlocks(blocksProp);
  }, [initialMetadata, blocksProp, messageId]);

  const patchProposal = useCallback(
    async (proposalId: string, patch: Record<string, unknown>) => {
      const next = patchStructuredProposal(meta, proposalId, patch);
      setMeta(next);
      setBlocks((prev) =>
        prev.map((b) =>
          "proposalId" in b && b.proposalId === proposalId ? ({ ...b, ...patch } as AssistantStructuredResult) : b,
        ),
      );
      await onUpdateMessage(next);
    },
    [meta, onUpdateMessage],
  );

  const handleApprove = useCallback(
    async (p: SendProposalResult | SwapProposalResult | NaviDepositProposalResult | NaviWithdrawProposalResult) => {
      if (p.type !== "send_proposal") {
        await patchProposal(p.proposalId, {
          status: "failed",
          errorMessage:
            "This action cannot be signed from the assistant yet. Use the matching screen in Destrall (swap, Navi, etc.).",
        });
        await onReloadThread();
        return;
      }

      if (!p.transferRequestId) {
        await patchProposal(p.proposalId, {
          status: "failed",
          errorMessage: "Missing transfer session. Ask again to prepare the send.",
        });
        return;
      }

      await patchProposal(p.proposalId, { status: "executing", errorMessage: undefined });
      try {
        const result = await desktopConfirmTransfer(p.transferRequestId);
        await patchProposal(p.proposalId, {
          status: "success",
          digest: result.digest,
          explorerUrl: result.explorerUrl,
          errorMessage: undefined,
        });
        const resultBlock = serializeAssistantMessageMetadata([
          {
            type: "transaction_result",
            title: "Transfer submitted",
            digest: result.digest,
            explorerUrl: result.explorerUrl,
            summary: `Sent on Sui. Digest ${result.digest.slice(0, 10)}…`,
          },
        ]);
        const { desktopAssistantChatAddMessage } = await import("@/lib/desktopAssistantChat");
        await desktopAssistantChatAddMessage({
          accountId,
          chatId,
          role: "assistant",
          content: "Transfer submitted.",
          metadata: resultBlock,
        });
        await onReloadThread();
        void useWalletStore.getState().refreshWallets();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Transfer failed.";
        await patchProposal(p.proposalId, {
          status: "failed",
          errorMessage: msg,
        });
        await onReloadThread();
      }
    },
    [accountId, chatId, onReloadThread, patchProposal],
  );

  const handleReject = useCallback(
    async (proposalId: string) => {
      await patchProposal(proposalId, { status: "rejected", errorMessage: undefined });
      await onReloadThread();
    },
    [patchProposal, onReloadThread],
  );

  return (
    <div className="space-y-3">
      {blocks.map((b, i) => (
        <Fragment key={"proposalId" in b ? b.proposalId : `${b.type}-${i}`}>
          <StructuredBlockView
            messageId={messageId}
            block={b}
            onApprove={() => {
              if (isProposalStructuredResult(b) && b.status === "pending") void handleApprove(b);
            }}
            onReject={() => {
              if (isProposalStructuredResult(b) && b.status === "pending") void handleReject(b.proposalId);
            }}
          />
        </Fragment>
      ))}
    </div>
  );
}

function StructuredBlockView({
  messageId,
  block,
  onApprove,
  onReject,
}: {
  messageId: string;
  block: AssistantStructuredResult;
  onApprove: () => void;
  onReject: () => void;
}) {
  switch (block.type) {
    case "portfolio_summary": {
      const holdings = block.assets.map((a) => ({
        symbol: a.symbol,
        name: a.name,
        amount: a.balanceFormatted,
        valueUsd: a.valueUsd?.startsWith("$") ? a.valueUsd : a.valueUsd ? `$${a.valueUsd}` : undefined,
        change24h: a.changePercent24h,
      }));
      const totalUsd =
        block.totalUsd == null
          ? undefined
          : block.totalUsd.startsWith("$")
            ? block.totalUsd
            : `$${block.totalUsd}`;
      return (
        <WalletBubble
          payload={{
            view: "portfolio",
            title: "Portfolio",
            network: block.network,
            totalUsd,
            holdings,
          }}
        />
      );
    }
    case "yield_positions":
      return (
        <WalletBubble
          payload={{
            view: "yield",
            title: "Yield positions",
            network: block.network,
            totalUsd: block.totalUsd,
            positions: block.positions.map((p) => ({
              protocol: p.protocol,
              asset: p.asset,
              supplied: p.supplied,
              apy: p.apy,
              valueUsd: p.valueUsd,
            })),
            emptyHint: block.emptyHint,
          }}
        />
      );
    case "available_yield_pools":
      return (
        <ProtocolBubble
          payload={{
            view: "pools",
            title: "Available yield pools",
            source: block.protocolLabel,
            pools: block.pools.map((p) => ({
              protocol: p.protocol,
              asset: p.asset,
              apy: p.apy,
              tvlUsd: p.tvlUsd,
              utilization: p.utilization,
            })),
            emptyHint: block.emptyHint,
          }}
        />
      );
    case "swappable_tokens":
      return (
        <ProtocolBubble
          payload={{
            view: "coins",
            title: "Swappable coins",
            source: block.routerLabel,
            coins: block.coins.map((c) => ({
              symbol: c.symbol,
              name: c.name,
              network: c.network,
              liquidityUsd: c.liquidityUsd,
            })),
            emptyHint: block.emptyHint,
          }}
        />
      );
    case "send_proposal":
    case "swap_proposal":
    case "navi_deposit_proposal":
    case "navi_withdraw_proposal":
      return (
        <ActionBubble
          msg={proposalToActionMessage(messageId, block)}
          onApprove={onApprove}
          onReject={onReject}
        />
      );
    case "transaction_result":
      return (
        <TransactionResultBubble
          digest={block.digest}
          title={block.title}
          summary={block.summary}
          explorerUrl={block.explorerUrl}
        />
      );
    case "error":
      return <StructuredErrorBubble message={block.message} />;
    default:
      return (
        <StructuredErrorBubble message="Unsupported structured assistant payload." />
      );
  }
}
