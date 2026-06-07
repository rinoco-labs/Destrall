import { Fragment, useCallback, useEffect, useState } from "react";
import { formatWalletAddress } from "../../../shared/formatWalletAddress";
import { formatSlippageBpsForDisplay } from "../../../shared/swap/slippage";
import { Loader2, Users, Zap } from "lucide-react";
import type {
  AssistantStructuredResult,
  CompositeSwapThenDepositResult,
  ContactDisambiguationResult,
  TokenDisambiguationResult,
  RebalanceProposalResult,
  SendProposalResult,
  SwapProposalResult,
  NaviDepositProposalResult,
  NaviWithdrawProposalResult,
  TriggerProposalResult,
  TriggerListResult,
} from "../../../assistant/assistantResultTypes";
import { isProposalStructuredResult } from "../../../assistant/assistantResultTypes";
import {
  patchStructuredProposal,
  patchTriggerListInMetadata,
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
import { AssistantCapabilitiesCard } from "./AssistantCapabilitiesCard";
import {
  desktopConfirmTransfer,
  desktopExecuteComposite,
  desktopExecuteNaviYield,
  desktopExecuteRebalance,
  desktopExecuteSwap,
  desktopPrepareTransfer,
} from "@/lib/desktopChain";
import { useWalletStore } from "@/stores/walletStore";
import { useNetworkStore } from "@/stores/networkStore";
import {
  desktopAssistantChatAddMessage,
  desktopAssistantResolveContactDisambiguation,
  desktopAssistantResolveTokenDisambiguation,
} from "@/lib/desktopAssistantChat";
import { PendingProposalCriticalFlows } from "@/components/PendingProposalCriticalFlows";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  desktopTriggersApprove,
  desktopTriggersDelete,
  desktopTriggersList,
  desktopTriggersPause,
  desktopTriggersResume,
} from "@/lib/desktopTriggers";
import { mapTriggerRecordsToListResult } from "@services/triggers/triggerListMapper";

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
  onTryPrompt,
}: {
  accountId: string;
  chatId: string;
  messageId: string;
  initialMetadata: string | null;
  blocks: AssistantStructuredResult[];
  onUpdateMessage: (metadata: string) => Promise<void>;
  onReloadThread: () => Promise<void>;
  onTryPrompt?: (prompt: string) => void;
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
    async (
      p:
        | SendProposalResult
        | SwapProposalResult
        | NaviDepositProposalResult
        | NaviWithdrawProposalResult
        | CompositeSwapThenDepositResult
        | RebalanceProposalResult,
    ) => {
      if (p.type === "composite_swap_then_deposit") {
        const snap = p.proposalSnapshot;
        if (!snap) {
          await patchProposal(p.proposalId, {
            status: "failed",
            errorMessage: "Missing composite proposal data. Ask again to prepare.",
          });
          return;
        }
        if (accountId !== snap.accountId) {
          await patchProposal(p.proposalId, {
            status: "failed",
            errorMessage: "This composite action was prepared for another account.",
          });
          return;
        }
        const net = useNetworkStore.getState().network;
        if (!net || net.activeEnvironment !== snap.suiEnvironment) {
          await patchProposal(p.proposalId, {
            status: "failed",
            errorMessage: "Network changed. Prepare the composite action again.",
          });
          return;
        }
        if (Date.now() > snap.expiresAtMs) {
          await patchProposal(p.proposalId, {
            status: "failed",
            errorMessage: "Composite proposal expired. Prepare again.",
          });
          return;
        }

        await patchProposal(p.proposalId, { status: "executing", errorMessage: undefined });
        try {
          const result = await desktopExecuteComposite({ accountId, proposalSnapshot: snap });
          await patchProposal(p.proposalId, {
            status: "success",
            digest: result.digest,
            explorerUrl: result.explorerUrl,
            errorMessage: undefined,
          });
          const resultBlock = serializeAssistantMessageMetadata([
            {
              type: "yield_execution_result",
              title: "Composite action submitted",
              digest: result.digest,
              explorerUrl: result.explorerUrl,
              summary: `Swap + deposit submitted. Digest ${result.digest.slice(0, 10)}…`,
              kind: "deposit",
            },
          ]);
          await desktopAssistantChatAddMessage({
            accountId,
            chatId,
            role: "assistant",
            content: "Composite swap and deposit submitted.",
            metadata: resultBlock,
          });
          await onReloadThread();
          void useWalletStore.getState().refreshWallets();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Composite transaction failed.";
          await patchProposal(p.proposalId, { status: "failed", errorMessage: msg });
          await onReloadThread();
        }
        return;
      }

      if (p.type === "rebalance_proposal") {
        const snap = p.proposalSnapshot;
        if (!snap || !p.executable) {
          await patchProposal(p.proposalId, {
            status: "failed",
            errorMessage: "Rebalance is not executable. Prepare swaps individually from the plan.",
          });
          return;
        }
        if (Date.now() > snap.expiresAtMs) {
          await patchProposal(p.proposalId, {
            status: "failed",
            errorMessage: "Rebalance proposal expired. Prepare again.",
          });
          return;
        }
        await patchProposal(p.proposalId, { status: "executing", errorMessage: undefined });
        try {
          const result = await desktopExecuteRebalance({ accountId, proposalSnapshot: snap });
          await patchProposal(p.proposalId, {
            status: "success",
            digest: result.digest,
            explorerUrl: result.explorerUrl,
          });
          await desktopAssistantChatAddMessage({
            accountId,
            chatId,
            role: "assistant",
            content: "Rebalance submitted.",
            metadata: serializeAssistantMessageMetadata([
              {
                type: "swap_execution_result",
                title: "Rebalance submitted",
                digest: result.digest,
                explorerUrl: result.explorerUrl,
                summary: `Rebalance PTB submitted. Digest ${result.digest.slice(0, 10)}…`,
              },
            ]),
          });
          await onReloadThread();
          void useWalletStore.getState().refreshWallets();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Rebalance failed.";
          await patchProposal(p.proposalId, { status: "failed", errorMessage: msg });
          await onReloadThread();
        }
        return;
      }

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

      if (p.type === "navi_deposit_proposal" || p.type === "navi_withdraw_proposal") {
        const snap = p.proposalSnapshot;
        if (!snap) {
          await patchProposal(p.proposalId, {
            status: "failed",
            errorMessage: "Missing Navi proposal data. Ask again to prepare the transaction.",
          });
          return;
        }
        if (accountId !== snap.accountId) {
          await patchProposal(p.proposalId, {
            status: "failed",
            errorMessage:
              "This proposal was prepared for another account. Switch back to that account or dismiss the card.",
          });
          return;
        }
        const net = useNetworkStore.getState().network;
        if (!net || net.activeEnvironment !== snap.suiEnvironment) {
          await patchProposal(p.proposalId, {
            status: "failed",
            errorMessage:
              "The selected network no longer matches this proposal. Prepare the transaction again on the correct network.",
          });
          return;
        }
        if (Date.now() > snap.expiresAtMs) {
          await patchProposal(p.proposalId, {
            status: "failed",
            errorMessage: "Proposal expired. Please prepare a new transaction.",
          });
          return;
        }

        await patchProposal(p.proposalId, { status: "executing", errorMessage: undefined });
        try {
          const result = await desktopExecuteNaviYield({ accountId, proposalSnapshot: snap });
          await patchProposal(p.proposalId, {
            status: "success",
            digest: result.digest,
            explorerUrl: result.explorerUrl,
            errorMessage: undefined,
          });
          const verb = snap.kind === "deposit" ? "Deposit" : "Withdraw";
          const resultBlock = serializeAssistantMessageMetadata([
            {
              type: "yield_execution_result",
              title: `Navi ${verb} submitted`,
              digest: result.digest,
              explorerUrl: result.explorerUrl,
              summary: `Navi ${verb.toLowerCase()} on Sui. Digest ${result.digest.slice(0, 10)}…`,
              kind: snap.kind,
            },
          ]);
          await desktopAssistantChatAddMessage({
            accountId,
            chatId,
            role: "assistant",
            content: `Navi ${verb.toLowerCase()} submitted.`,
            metadata: resultBlock,
          });
          await onReloadThread();
          void useWalletStore.getState().refreshWallets();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Navi transaction failed.";
          await patchProposal(p.proposalId, {
            status: "failed",
            errorMessage: msg,
          });
          await onReloadThread();
        }
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
            walletDecimals: snap.decimals,
            walletBalanceRaw: snap.walletBalanceRaw,
            walletSymbol: snap.symbol,
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

  const patchTriggerList = useCallback(
    async (triggers: TriggerListResult["triggers"]) => {
      const nextMeta = patchTriggerListInMetadata(meta, triggers);
      setMeta(nextMeta);
      setBlocks((prev) =>
        prev.map((b) => (b.type === "trigger_list" ? { ...b, triggers } : b)),
      );
      await onUpdateMessage(nextMeta);
    },
    [meta, onUpdateMessage],
  );

  return (
    <div className="space-y-3">
      <PendingProposalCriticalFlows blocks={blocks} />
      {blocks.map((b, i) => (
        <Fragment
          key={
            b.type === "composite_swap_then_deposit"
              ? b.compositeId
              : "proposalId" in b && typeof b.proposalId === "string"
                ? b.proposalId
                : `${b.type}-${i}`
          }
        >
          <StructuredBlockView
            accountId={accountId}
            chatId={chatId}
            messageId={messageId}
            block={b}
            meta={meta}
            onUpdateMessage={onUpdateMessage}
            onTryPrompt={onTryPrompt}
            onApprove={() => {
              if (b.type === "composite_swap_then_deposit" && b.status === "pending") {
                void handleApprove(b);
                return;
              }
              if (b.type === "rebalance_proposal" && b.status === "pending" && b.executable) {
                void handleApprove(b);
                return;
              }
              if (
                isProposalStructuredResult(b) &&
                b.type !== "trigger_proposal" &&
                b.status === "pending"
              ) {
                void handleApprove(b);
              }
            }}
            onReject={() => {
              if (b.type === "composite_swap_then_deposit" && b.status === "pending") {
                void handleReject(b.proposalId);
                return;
              }
              if (b.type === "rebalance_proposal" && b.status === "pending") {
                void handleReject(b.proposalId);
                return;
              }
              if (isProposalStructuredResult(b) && b.status === "pending") void handleReject(b.proposalId);
            }}
            onReloadThread={onReloadThread}
            onPatchTriggerList={patchTriggerList}
          />
        </Fragment>
      ))}
    </div>
  );
}

function TokenDisambiguationCard({
  accountId,
  chatId,
  messageId,
  block,
  onReloadThread,
}: {
  accountId: string;
  chatId: string;
  messageId: string;
  block: TokenDisambiguationResult;
  onReloadThread: () => Promise<void>;
}) {
  const [busyType, setBusyType] = useState<string | null>(null);
  const pick = async (pickedCoinType: string) => {
    setBusyType(pickedCoinType);
    try {
      await desktopAssistantResolveTokenDisambiguation({
        accountId,
        chatId,
        messageId,
        disambiguationId: block.disambiguationId,
        pickedCoinType,
      });
      await onReloadThread();
    } finally {
      setBusyType(null);
    }
  };

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-md rounded-2xl border border-sky-500/40 bg-card/60 p-4 space-y-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] text-sky-600 uppercase">Choose token</p>
          <p className="text-sm font-semibold">Multiple matches for “{block.userInput}”</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pick the token you want to use. Balances are from your connected wallet.
          </p>
        </div>
        <ul className="space-y-2">
          {block.matches.map((m) => (
            <li key={m.coinType}>
              <button
                type="button"
                disabled={busyType != null}
                onClick={() => void pick(m.coinType)}
                className="w-full flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2.5 text-left text-sm hover:bg-background/80 transition disabled:opacity-60"
              >
                <span className="font-semibold truncate">
                  {m.symbol} · {m.balanceFormatted}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[45%]">
                  {m.coinType.slice(0, 12)}…
                </span>
                {busyType === m.coinType ? (
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin text-brand" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
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
              I found multiple contacts matching “{block.originalRecipientQuery}”. Choose which one you want to send to.
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sending {block.amount} {block.token}. Tap the correct contact.
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
                <span
                  className="text-[11px] font-mono text-muted-foreground truncate max-w-[45%]"
                  title={m.address}
                >
                  {formatWalletAddress(m.address)}
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
  meta,
  onUpdateMessage,
  onApprove,
  onReject,
  onReloadThread,
  onTryPrompt,
  onPatchTriggerList,
}: {
  accountId: string;
  chatId: string;
  messageId: string;
  block: AssistantStructuredResult;
  meta: string | null;
  onUpdateMessage: (metadata: string) => Promise<void>;
  onApprove: () => void;
  onReject: () => void;
  onReloadThread: () => Promise<void>;
  onTryPrompt?: (prompt: string) => void;
  onPatchTriggerList: (triggers: TriggerListResult["triggers"]) => Promise<void>;
}) {
  switch (block.type) {
    case "assistant_capabilities":
      return <AssistantCapabilitiesCard payload={block} onTryPrompt={onTryPrompt} />;
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
            concentrationNote: block.concentrationNote,
          }}
        />
      );
    }
    case "wallet_address":
      return (
        <WalletBubble
          payload={{
            view: "wallet_address",
            title: "Wallet address",
            network: block.network,
            accountLabel: block.accountLabel,
            address: block.address,
          }}
        />
      );
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
              currentValue: p.currentValue,
              accruedInterest: p.accruedInterest,
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
            recommendationNote: block.recommendationNote,
            pools: block.pools.map((p) => ({
              protocol: p.protocol,
              asset: p.asset,
              apy: p.apy,
              tvlUsd: p.tvlUsd,
              utilization: p.utilization,
              riskLabel: p.riskLabel,
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
    case "token_disambiguation":
      return (
        <TokenDisambiguationCard
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
    case "composite_swap_then_deposit": {
      return (
        <div className="space-y-3">
          <div className="rounded-2xl border border-sky-500/35 bg-card/50 p-4 space-y-2 text-sm max-w-md">
            <p className="text-[10px] font-bold tracking-[0.18em] text-sky-600 uppercase">
              {block.executionModel === "ptb" ? "Composite action" : "Staged swap → deposit"}
            </p>
            {block.executionModel === "ptb" && block.card ? (
              <>
                <ol className="text-xs space-y-1 list-decimal pl-4 text-muted-foreground">
                  {block.steps.map((s) => (
                    <li key={s.index}>{s.label}</li>
                  ))}
                </ol>
                <ActionBubble
                  msg={{
                    id: `${messageId}:${block.proposalId}`,
                    kind: "action",
                    status: block.status,
                    title: block.card.title,
                    label: block.card.label,
                    source: block.card.source,
                    flows: block.card.flows,
                    details: block.card.details,
                    note: block.card.note,
                    digest: block.digest,
                    errorMessage: block.errorMessage,
                  }}
                  onApprove={onApprove}
                  onReject={onReject}
                />
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Approve the swap first, then prepare deposit of ~{block.depositPreview.amountDisplay}{" "}
                  {block.depositPreview.asset}.
                </p>
                <ActionBubble
                  msg={proposalToActionMessage(messageId, block.swapProposal)}
                  onApprove={onApprove}
                  onReject={onReject}
                />
              </>
            )}
            <ul className="text-xs space-y-1 list-disc pl-4 text-muted-foreground">
              {block.riskNotes.map((r, idx) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      );
    }
    case "rebalance_proposal":
      if (block.executable && block.status === "pending") {
        return (
          <div className="space-y-3">
            <ProtocolBubble
              payload={{
                view: "rebalance",
                title: "Rebalance plan",
                source: "Destrall planner",
                network: block.network,
                currentPct: block.currentPct,
                targetPct: block.targetPct,
                swaps: block.swaps,
                riskNotes: block.riskNotes,
                gasNote: block.gasNote,
                dustSkipped: block.dustSkipped,
              }}
            />
            <ActionBubble
              msg={{
                id: `${messageId}:${block.proposalId}`,
                kind: "action",
                status: block.status ?? "pending",
                title: "Rebalance portfolio",
                label: `${block.swaps.length} swap leg(s) · one PTB`,
                source: { type: "package", name: "DESTRALL REBALANCE" },
                flows: block.swaps.map((s) => ({
                  direction: "out" as const,
                  amount: s.amountDisplay,
                  token: s.fromSymbol,
                  kind: "token" as const,
                })),
                details: [
                  { k: "Legs", v: String(block.swaps.length) },
                  { k: "Network", v: block.network },
                ],
                note: "Approving signs one programmable transaction with all rebalance swaps.",
                digest: block.digest,
                errorMessage: block.errorMessage,
              }}
              onApprove={onApprove}
              onReject={onReject}
            />
          </div>
        );
      }
      return (
        <ProtocolBubble
          payload={{
            view: "rebalance",
            title: "Rebalance plan",
            source: "Destrall planner",
            network: block.network,
            currentPct: block.currentPct,
            targetPct: block.targetPct,
            swaps: block.swaps,
            riskNotes: block.riskNotes,
            gasNote: block.gasNote,
            dustSkipped: block.dustSkipped,
          }}
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
    case "yield_execution_result":
      return (
        <TransactionResultBubble
          digest={block.digest}
          title={block.title}
          summary={block.summary}
          explorerUrl={block.explorerUrl}
        />
      );
    case "trigger_proposal":
      return (
        <TriggerProposalCard
          accountId={accountId}
          block={block}
          meta={meta}
          onUpdateMessage={onUpdateMessage}
          onReloadThread={onReloadThread}
        />
      );
    case "trigger_list":
      return (
        <TriggerListCard
          accountId={accountId}
          block={block}
          onPatchTriggerList={onPatchTriggerList}
        />
      );
    case "time_info":
      return (
        <div className="rounded-2xl border border-border bg-card/60 p-4 max-w-sm text-sm space-y-1">
          <p className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">Current time</p>
          <p className="font-medium">{block.formatted}</p>
          <p className="text-xs text-muted-foreground">
            {block.weekday} · {block.utcOffset}
          </p>
        </div>
      );
    case "error":
      return <StructuredErrorBubble message={block.message} />;
    default:
      return (
        <StructuredErrorBubble message="Unsupported structured assistant payload." />
      );
  }
}

function TriggerProposalCard({
  accountId,
  block,
  meta,
  onUpdateMessage,
  onReloadThread,
}: {
  accountId: string;
  block: TriggerProposalResult;
  meta: string | null;
  onUpdateMessage: (metadata: string) => Promise<void>;
  onReloadThread: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const snap = block.proposalSnapshot;

  const patch = async (p: Record<string, unknown>) => {
    await onUpdateMessage(patchStructuredProposal(meta, block.proposalId, p));
    await onReloadThread();
  };

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-card/60 p-4 max-w-md space-y-3 text-sm">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-500" />
        <p className="text-[10px] font-bold tracking-[0.18em] text-amber-600 uppercase">Trigger review</p>
      </div>
      <p className="font-semibold">{block.name}</p>
      <dl className="text-xs space-y-1">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Condition</dt>
          <dd className="text-right">{block.conditionSummary}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Action</dt>
          <dd className="text-right">{block.actionSummary}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Account</dt>
          <dd>{block.accountLabel}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Network</dt>
          <dd>{block.network}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Max runs</dt>
          <dd>{block.maxExecutionsLabel}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Slippage cap</dt>
          <dd>{formatSlippageBpsForDisplay(block.slippageBps)}</dd>
        </div>
        {(block.scheduleDisplay || block.scheduleLabel) && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Time</dt>
            <dd className="text-right">{block.scheduleDisplay ?? block.scheduleLabel}</dd>
          </div>
        )}
        {block.nextExecutionLabel && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Next run</dt>
            <dd className="text-right">{block.nextExecutionLabel}</dd>
          </div>
        )}
        {block.executionMode && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Execution</dt>
            <dd>{block.executionMode === "one-time" ? "One-time" : "Recurring"}</dd>
          </div>
        )}
      </dl>
      <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
        {block.riskNotes.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {block.status === "pending" && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            disabled={busy || !snap}
            onClick={async () => {
              if (!snap) return;
              setBusy(true);
              try {
                await desktopTriggersApprove({ accountId, proposalSnapshot: snap });
                await patch({ status: "approved" });
              } catch (e) {
                await patch({
                  status: "rejected",
                  errorMessage: e instanceof Error ? e.message : "Approval failed",
                });
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Approve Trigger"}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void patch({ status: "rejected" })}>
            Cancel
          </Button>
        </div>
      )}
      {block.status === "approved" && <p className="text-xs text-emerald-600">Trigger saved and active.</p>}
    </div>
  );
}

type TriggerListItem = TriggerListResult["triggers"][number];
type TriggerRowAction = { triggerId: string; kind: "pause" | "resume" | "delete" } | null;

function TriggerListCard({
  accountId,
  block,
  onPatchTriggerList,
}: {
  accountId: string;
  block: TriggerListResult;
  onPatchTriggerList: (triggers: TriggerListResult["triggers"]) => Promise<void>;
}) {
  const [triggers, setTriggers] = useState<TriggerListItem[]>(block.triggers);
  const [pendingAction, setPendingAction] = useState<TriggerRowAction>(null);
  const [deleteTarget, setDeleteTarget] = useState<TriggerListItem | null>(null);

  const syncTriggers = useCallback(async () => {
    const rows = await desktopTriggersList(accountId);
    const items = mapTriggerRecordsToListResult(rows);
    setTriggers(items);
    await onPatchTriggerList(items);
    return items;
  }, [accountId, onPatchTriggerList]);

  useEffect(() => {
    setTriggers(block.triggers);
  }, [block.triggers]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await desktopTriggersList(accountId);
        if (!cancelled) {
          setTriggers(mapTriggerRecordsToListResult(rows));
        }
      } catch (e) {
        console.warn("[triggers] chat list refresh failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const runStatusAction = async (triggerId: string, kind: "pause" | "resume") => {
    setPendingAction({ triggerId, kind });
    try {
      if (kind === "pause") {
        await desktopTriggersPause(accountId, triggerId);
      } else {
        await desktopTriggersResume(accountId, triggerId);
      }
      await syncTriggers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Could not ${kind} trigger`);
    } finally {
      setPendingAction(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const triggerId = deleteTarget.id;
    setPendingAction({ triggerId, kind: "delete" });
    try {
      await desktopTriggersDelete(accountId, triggerId);
      setDeleteTarget(null);
      await syncTriggers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete trigger");
    } finally {
      setPendingAction(null);
    }
  };

  const isRowBusy = (triggerId: string) => pendingAction?.triggerId === triggerId;

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 max-w-md space-y-3 text-sm">
      <p className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">Your triggers</p>
      {triggers.length === 0 ? (
        <p className="text-muted-foreground text-xs">No triggers for this account.</p>
      ) : (
        <ul className="space-y-2">
          {triggers.map((t) => {
            const busy = isRowBusy(t.id);
            const pausing = busy && pendingAction?.kind === "pause";
            const resuming = busy && pendingAction?.kind === "resume";
            const deleting = busy && pendingAction?.kind === "delete";

            return (
              <li key={t.id} className="rounded-lg border border-border/60 p-3 space-y-1">
                <p className="font-medium text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {t.typeLabel} · {t.status}
                </p>
                <p className="text-xs">{t.conditionSummary}</p>
                <p className="text-xs text-muted-foreground">{t.actionSummary}</p>
                {t.nextCheckLabel ? (
                  <p className="text-xs text-muted-foreground">Next: {t.nextCheckLabel}</p>
                ) : null}
                <div className="flex flex-wrap gap-1 pt-1">
                  {t.status === "active" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={busy}
                      onClick={() => void runStatusAction(t.id, "pause")}
                    >
                      {pausing ? <Loader2 className="w-3 h-3 animate-spin" /> : "Pause"}
                    </Button>
                  )}
                  {t.status === "paused" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={busy}
                      onClick={() => void runStatusAction(t.id, "resume")}
                    >
                      {resuming ? <Loader2 className="w-3 h-3 animate-spin" /> : "Resume"}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive"
                    disabled={busy}
                    onClick={() => setDeleteTarget(t)}
                  >
                    {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !pendingAction) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this trigger?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the trigger and it will no longer run.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingAction?.kind === "delete"}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pendingAction?.kind === "delete"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {pendingAction?.kind === "delete" ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
