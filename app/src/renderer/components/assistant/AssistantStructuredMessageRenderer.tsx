import { Fragment, useCallback, useEffect, useState } from "react";
import type {
  AssistantStructuredResult,
  ContactDisambiguationResult,
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
import { desktopConfirmTransfer, desktopExecuteSwap, desktopPrepareTransfer } from "@/lib/desktopChain";
import { useWalletStore } from "@/stores/walletStore";
import { useNetworkStore } from "@/stores/networkStore";
import {
  desktopAssistantChatAddMessage,
  desktopAssistantResolveContactDisambiguation,
} from "@/lib/desktopAssistantChat";
import { Loader2, Users } from "lucide-react";

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
      if (p.type === "swap_proposal") {
        const snap = p.proposalSnapshot;
        if (!snap) {
          await patchProposal(p.proposalId, {
            status: "failed",
            errorMessage: "Missing swap proposal data. Ask again to prepare the swap.",
          });
          return;
        }
        if (accountId !== snap.accountId) {
          await patchProposal(p.proposalId, {
            status: "failed",
            errorMessage:
              "This swap was prepared for another account. Switch back to that account or dismiss the card.",
          });
          return;
        }
        const net = useNetworkStore.getState().network;
        if (!net || net.activeEnvironment !== snap.suiEnvironment) {
          await patchProposal(p.proposalId, {
            status: "failed",
            errorMessage:
              "The selected network no longer matches this proposal. Prepare the swap again on the correct network.",
          });
          return;
        }
        if (Date.now() > snap.quoteExpiresAtMs) {
          await patchProposal(p.proposalId, {
            status: "failed",
            errorMessage: "Quote expired. Please request a new quote.",
          });
          return;
        }

        await patchProposal(p.proposalId, { status: "executing", errorMessage: undefined });
        try {
          const result = await desktopExecuteSwap({ accountId, proposalSnapshot: snap });
          await patchProposal(p.proposalId, {
            status: "success",
            digest: result.digest,
            explorerUrl: result.explorerUrl,
            errorMessage: undefined,
          });
          const resultBlock = serializeAssistantMessageMetadata([
            {
              type: "swap_execution_result",
              title: "Swap submitted",
              digest: result.digest,
              explorerUrl: result.explorerUrl,
              summary: `Swap submitted on Sui. Digest ${result.digest.slice(0, 10)}…`,
            },
          ]);
          await desktopAssistantChatAddMessage({
            accountId,
            chatId,
            role: "assistant",
            content: "Swap submitted.",
            metadata: resultBlock,
          });
          await onReloadThread();
          void useWalletStore.getState().refreshWallets();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Swap transaction failed.";
          await patchProposal(p.proposalId, {
            status: "failed",
            errorMessage: msg,
          });
          await onReloadThread();
        }
        return;
      }

      if (p.type !== "send_proposal") {
        await patchProposal(p.proposalId, {
          status: "failed",
          errorMessage:
            "This action cannot be signed from the assistant yet. Use the matching screen in Destrall (Navi, etc.).",
        });
        await onReloadThread();
        return;
      }

      const snap = p.proposalSnapshot;
      if (snap) {
        if (accountId !== snap.accountId) {
          await patchProposal(p.proposalId, {
            status: "failed",
            errorMessage:
              "This send was prepared for another account. Switch back to that account or dismiss the card.",
          });
          return;
        }
        const net = useNetworkStore.getState().network;
        if (!net || net.activeEnvironment !== snap.suiEnvironment) {
          await patchProposal(p.proposalId, {
            status: "failed",
            errorMessage:
              "The selected network no longer matches this proposal. Prepare the send again on the correct network.",
          });
          return;
        }
      } else if (!p.transferRequestId) {
        await patchProposal(p.proposalId, {
          status: "failed",
          errorMessage: "Missing transfer session. Ask again to prepare the send.",
        });
        return;
      }

      await patchProposal(p.proposalId, { status: "executing", errorMessage: undefined });
      try {
        let transferRequestId = p.transferRequestId;
        if (snap) {
          const prep = await desktopPrepareTransfer({
            accountId,
            recipient: snap.recipientAddress,
            coinType: snap.coinType,
            amountDisplay: snap.amountDisplay,
          });
          transferRequestId = prep.transferRequestId;
        }
        if (!transferRequestId) {
          throw new Error("Missing transfer session.");
        }
        const result = await desktopConfirmTransfer(transferRequestId);
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
      await desktopAssistantChatAddMessage({
        accountId,
        chatId,
        role: "assistant",
        content: "Proposal dismissed. Nothing was submitted on-chain.",
        metadata: null,
      });
      await onReloadThread();
    },
    [accountId, chatId, patchProposal, onReloadThread],
  );

  return (
    <div className="space-y-3">
      {blocks.map((b, i) => (
        <Fragment key={"proposalId" in b ? b.proposalId : `${b.type}-${i}`}>
          <StructuredBlockView
            accountId={accountId}
            chatId={chatId}
            messageId={messageId}
            block={b}
            onApprove={() => {
              if (isProposalStructuredResult(b) && b.status === "pending") void handleApprove(b);
            }}
            onReject={() => {
              if (isProposalStructuredResult(b) && b.status === "pending") void handleReject(b.proposalId);
            }}
            onReloadThread={onReloadThread}
          />
        </Fragment>
      ))}
    </div>
  );
}

function ContactDisambiguationCard({
  accountId,
  chatId,
  messageId,
  block,
  onReloadThread,
}: {
  accountId: string;
  chatId: string;
  messageId: string;
  block: ContactDisambiguationResult;
  onReloadThread: () => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const pick = async (pickedMatchId: string) => {
    setBusyId(pickedMatchId);
    try {
      await desktopAssistantResolveContactDisambiguation({
        accountId,
        chatId,
        messageId,
        disambiguationId: block.disambiguationId,
        pickedMatchId,
      });
      await onReloadThread();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex justify-start">
      <div
        className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-card/60 p-4 space-y-3"
        style={{
          background:
            "linear-gradient(160deg, color-mix(in oklab, oklch(0.75 0.12 85) 10%, var(--card)) 0%, var(--card) 60%)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.18em] text-amber-600 uppercase">
              Choose recipient
            </p>
            <p className="text-sm font-semibold">
              Multiple matches for “{block.originalRecipientQuery}”
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sending {block.amount} {block.token}. Tap the correct contact or account.
            </p>
          </div>
        </div>
        <ul className="space-y-2">
          {block.matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                disabled={busyId != null}
                onClick={() => void pick(m.id)}
                className="w-full flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2.5 text-left text-sm hover:bg-background/80 transition disabled:opacity-60"
              >
                <span className="font-semibold truncate">{m.name}</span>
                <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[45%]">
                  {m.address.slice(0, 10)}…{m.address.slice(-6)}
                </span>
                {busyId === m.id ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-brand" /> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StructuredBlockView({
  accountId,
  chatId,
  messageId,
  block,
  onApprove,
  onReject,
  onReloadThread,
}: {
  accountId: string;
  chatId: string;
  messageId: string;
  block: AssistantStructuredResult;
  onApprove: () => void;
  onReject: () => void;
  onReloadThread: () => Promise<void>;
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
            title: "Tokens you can swap to (Sui)",
            source: block.routerLabel,
            coins: block.coins.map((c) => ({
              symbol: c.symbol,
              name: c.name,
              network: c.network,
              liquidityUsd: c.liquidityUsd,
              routerStatus: c.routerStatus,
              coinType: c.coinType,
              decimals: c.decimals,
              iconUrl: c.iconUrl,
            })),
            emptyHint: block.emptyHint,
          }}
        />
      );
    case "contact_disambiguation":
      return (
        <ContactDisambiguationCard
          accountId={accountId}
          chatId={chatId}
          messageId={messageId}
          block={block}
          onReloadThread={onReloadThread}
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
    case "swap_execution_result":
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
