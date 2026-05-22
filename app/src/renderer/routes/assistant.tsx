import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Paperclip,
  Send,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  Pin,
  PinOff,
  Trash2,
  X,
  FileText,
  UploadCloud,
  PencilLine,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLogo } from "@/components/branding/AppLogo";
import { useWalletStore } from "@/stores/walletStore";
import { useAiModelStore } from "@/stores/aiModelStore";
import { useAssistantChatStore } from "@/stores/assistantChatStore";
import { isDestrallDesktop } from "@/lib/desktopWallet";
import type { AssistantChatRow, AssistantMessageRow } from "../../shared/assistantChat";
import { Input } from "@/components/ui/input";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AssistantStructuredMessageRenderer } from "@/components/assistant/AssistantStructuredMessageRenderer";
import { AssistantEmptyState } from "@/components/assistant/AssistantStarterChips";
import { parseAssistantMessageMetadata } from "../../assistant/assistantMessageMetadata";
import type { AssistantStructuredResult } from "../../assistant/assistantResultTypes";
import { desktopAssistantChatUpdateMessage } from "@/lib/desktopAssistantChat";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AssistantSearch = { prompt?: string };

export const Route = createFileRoute("/assistant")({
  validateSearch: (search: Record<string, unknown>): AssistantSearch => {
    const prompt = typeof search.prompt === "string" ? search.prompt.trim() : undefined;
    return prompt ? { prompt } : {};
  },
  component: AssistantPage,
  head: () => ({
    meta: [
      { title: "Assistant — Destrall" },
      { name: "description", content: "Chat with your local AI assistant." },
    ],
  }),
});


type Attachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  isImage: boolean;
};

type OverlayMsg =
  | { id: string; kind: "user"; text: string; attachments?: Attachment[] }
  | { id: string; kind: "assistant"; text: string };

type ThreadItem =
  | { key: string; type: "user"; id: string; text: string; attachments?: Attachment[] }
  | { key: string; type: "assistant_text"; messageId: string; text: string }
  | {
      key: string;
      type: "structured";
      messageId: string;
      chatId: string;
      metadata: string | null;
      blocks: AssistantStructuredResult[];
    };

function buildThreadItemsFromRows(rows: AssistantMessageRow[], chatId: string): ThreadItem[] {
  const out: ThreadItem[] = [];
  for (const r of rows) {
    if (r.role === "user") {
      out.push({
        key: `u:${r.id}`,
        type: "user",
        id: r.id,
        text: r.content,
      });
      continue;
    }
    if (r.role === "assistant") {
      const blocks = parseAssistantMessageMetadata(r.metadata);
      const text = r.content.trim();
      if (text) {
        out.push({
          key: `a:${r.id}:t`,
          type: "assistant_text",
          messageId: r.id,
          text: r.content,
        });
      }
      if (blocks.length > 0) {
        out.push({
          key: `a:${r.id}:s`,
          type: "structured",
          messageId: r.id,
          chatId,
          metadata: r.metadata,
          blocks,
        });
      }
      if (!text && blocks.length === 0) {
        out.push({
          key: `a:${r.id}:e`,
          type: "assistant_text",
          messageId: r.id,
          text: r.content,
        });
      }
    }
  }
  return out;
}

function buildOverlayThreadItems(overlay: OverlayMsg[]): ThreadItem[] {
  const out: ThreadItem[] = [];
  for (const m of overlay) {
    if (m.kind === "user") {
      out.push({
        key: `o-u:${m.id}`,
        type: "user",
        id: m.id,
        text: m.text,
        attachments: m.attachments,
      });
    } else {
      out.push({
        key: `o-a:${m.id}`,
        type: "assistant_text",
        messageId: m.id,
        text: m.text,
      });
    }
  }
  return out;
}

function formatChatListTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function UserBubble({ text, attachments }: { text: string; attachments?: Attachment[] }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-brand text-brand-foreground px-5 py-3 text-sm font-medium shadow-sm space-y-2">
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((a) =>
              a.isImage ? (
                <img
                  key={a.id}
                  src={a.url}
                  alt={a.name}
                  className="max-h-40 rounded-xl border border-white/20 object-cover"
                />
              ) : (
                <div
                  key={a.id}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs"
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate max-w-[160px]">{a.name}</span>
                </div>
              )
            )}
          </div>
        )}
        {text && <div>{text}</div>}
      </div>
    </div>
  );
}

function AssistantBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-3xl rounded-bl-lg border border-border bg-card/60 px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap">
        {text.split("**").map((chunk, i) =>
          i % 2 === 1 ? (
            <strong key={i} className="font-semibold">
              {chunk}
            </strong>
          ) : (
            <span key={i}>{chunk}</span>
          )
        )}
      </div>
    </div>
  );
}

function HistoryItem({
  row,
  active,
  onSelect,
  onPin,
  onRename,
  onDelete,
  subtitle,
}: {
  row: AssistantChatRow;
  active: boolean;
  onSelect: () => void;
  onPin: () => void;
  onRename: () => void;
  onDelete: () => void;
  subtitle: string;
}) {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onSelect}
        className={`w-full text-left pl-3 pr-9 py-2.5 rounded-xl text-sm font-medium transition ${
          active ? "bg-secondary/70 ring-1 ring-inset ring-brand/30" : "hover:bg-secondary/50"
        }`}
      >
        <div className="flex items-start gap-2 min-w-0">
          {row.pinned ? (
            <Pin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-brand" aria-hidden />
          ) : (
            <span className="w-3.5 shrink-0" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{row.title}</div>
            {subtitle ? (
              <div className="truncate text-[11px] text-muted-foreground mt-0.5 font-normal">
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Chat options"
            onClick={(e) => e.stopPropagation()}
            className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 transition"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-44 rounded-xl">
          <DropdownMenuItem onSelect={onRename} className="gap-2 text-xs font-medium cursor-pointer">
            <PencilLine className="w-3.5 h-3.5" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onPin} className="gap-2 text-xs font-medium cursor-pointer">
            {row.pinned ? (
              <>
                <PinOff className="w-3.5 h-3.5" />
                Unpin chat
              </>
            ) : (
              <>
                <Pin className="w-3.5 h-3.5" />
                Pin chat
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={onDelete}
            className="gap-2 text-xs font-medium text-rose-500 focus:text-rose-500 focus:bg-rose-500/10 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function AssistantPage() {
  const { prompt: promptFromUrl } = useSearch({ from: "/assistant" });
  const [historyOpen, setHistoryOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [overlayMessages, setOverlayMessages] = useState<OverlayMsg[]>([]);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const activeAccountId = useWalletStore((s) => s.activeAccountId);
  const isLoaded = useAiModelStore((s) => s.isLoaded);
  const isDownloaded = useAiModelStore((s) => s.isDownloaded);
  const isLoading = useAiModelStore((s) => s.isLoading);
  const isDownloading = useAiModelStore((s) => s.isDownloading);
  const runtimeError = useAiModelStore((s) => s.error);
  const initializeModel = useAiModelStore((s) => s.initializeModel);
  const refreshAi = useAiModelStore((s) => s.refreshFromMain);
  const downloadModel = useAiModelStore((s) => s.downloadModel);
  const loadModel = useAiModelStore((s) => s.loadModel);

  const initializeForAccount = useAssistantChatStore((s) => s.initializeForAccount);
  const createNewChat = useAssistantChatStore((s) => s.createNewChat);
  const selectChat = useAssistantChatStore((s) => s.selectChat);
  const sendChatMessage = useAssistantChatStore((s) => s.sendMessage);
  const searchChats = useAssistantChatStore((s) => s.searchChats);
  const pinChat = useAssistantChatStore((s) => s.pinChat);
  const unpinChat = useAssistantChatStore((s) => s.unpinChat);
  const removeChat = useAssistantChatStore((s) => s.deleteChat);
  const renameChat = useAssistantChatStore((s) => s.renameChat);
  const chatSearchOverride = useAssistantChatStore((s) => s.chatSearchOverride);
  const chatsByAccountId = useAssistantChatStore((s) => s.chatsByAccountId);
  const activeChatIdByAccountId = useAssistantChatStore((s) => s.activeChatIdByAccountId);
  const messagesByChatId = useAssistantChatStore((s) => s.messagesByChatId);
  const assistantStreaming = useAssistantChatStore((s) => s.assistantStreaming);
  const chatError = useAssistantChatStore((s) => s.error);
  const loadMessages = useAssistantChatStore((s) => s.loadMessages);

  const activeChatId =
    activeAccountId != null ? (activeChatIdByAccountId[activeAccountId] ?? null) : null;
  const persistedRows =
    activeAccountId && activeChatId
      ? (messagesByChatId[`${activeAccountId}:${activeChatId}`] ?? [])
      : [];
  const threadItems = useMemo(() => {
    const persisted =
      activeChatId != null ? buildThreadItemsFromRows(persistedRows, activeChatId) : [];
    return [...persisted, ...buildOverlayThreadItems(overlayMessages)];
  }, [persistedRows, overlayMessages, activeChatId]);

  useEffect(() => {
    void initializeForAccount(activeAccountId ?? null);
    setOverlayMessages([]);
    setSearch("");
  }, [activeAccountId, initializeForAccount]);

  useEffect(() => {
    if (promptFromUrl) {
      setMessage(promptFromUrl);
      textareaRef.current?.focus();
    }
  }, [promptFromUrl]);

  useEffect(() => {
    setOverlayMessages([]);
  }, [activeAccountId, activeChatId]);

  useEffect(() => {
    if (!activeAccountId) return;
    const t = window.setTimeout(() => {
      void searchChats(activeAccountId, search);
    }, 320);
    return () => window.clearTimeout(t);
  }, [activeAccountId, search, searchChats]);

  useEffect(() => {
    void initializeModel();
  }, [initializeModel]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [message]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [threadItems]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      attachments.forEach((a) => URL.revokeObjectURL(a.url));
    };
  }, []);

  const addFiles = (files: FileList | File[]) => {
    const next: Attachment[] = [];
    Array.from(files).forEach((f) => {
      const isImage = f.type.startsWith("image/");
      next.push({
        id: crypto.randomUUID(),
        name: f.name,
        size: f.size,
        type: f.type || "application/octet-stream",
        url: URL.createObjectURL(f),
        isImage,
      });
    });
    setAttachments((prev) => [...prev, ...next]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((a) => a.id !== id);
    });
  };

  const sendPrompt = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!isDestrallDesktop()) {
      setOverlayMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), kind: "user", text: trimmed },
        {
          id: crypto.randomUUID(),
          kind: "assistant",
          text: "Open the Destrall desktop app to chat with the on-device model.",
        },
      ]);
      return;
    }

    if (!activeAccountId) {
      setOverlayMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), kind: "user", text: trimmed },
        {
          id: crypto.randomUUID(),
          kind: "assistant",
          text: "No active wallet account. Unlock your wallet or add an account, then try again.",
        },
      ]);
      return;
    }

    if (!isLoaded) {
      void refreshAi();
      setOverlayMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), kind: "user", text: trimmed },
        {
          id: crypto.randomUUID(),
          kind: "assistant",
          text: "The assistant AI is not ready yet. Wait for it to finish loading, or open **Settings** to download it.",
        },
      ]);
      return;
    }

    try {
      await sendChatMessage(activeAccountId, activeChatId, trimmed);
      textareaRef.current?.focus();
    } catch (e) {
      const err = e instanceof Error ? e.message : "Could not send message.";
      setOverlayMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), kind: "assistant", text: `**Error**\n${err}` },
      ]);
    }
  };

  const handleSend = async () => {
    const text = message.trim();
    if (!text && attachments.length === 0) return;

    if (attachments.length > 0) {
      setOverlayMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          kind: "user",
          text,
          attachments: attachments.length ? attachments : undefined,
        },
        {
          id: crypto.randomUUID(),
          kind: "assistant",
          text: "File attachments are not sent to the local model yet. Paste text or try again without attachments.",
        },
      ]);
      setMessage("");
      setAttachments([]);
      return;
    }

    if (!isDestrallDesktop()) {
      setOverlayMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), kind: "user", text },
        {
          id: crypto.randomUUID(),
          kind: "assistant",
          text: "Open the Destrall desktop app to chat with the on-device model.",
        },
      ]);
      setMessage("");
      return;
    }

    if (!activeAccountId) {
      setOverlayMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), kind: "user", text },
        {
          id: crypto.randomUUID(),
          kind: "assistant",
          text: "No active wallet account. Unlock your wallet or add an account, then try again.",
        },
      ]);
      setMessage("");
      return;
    }

    if (!isLoaded) {
      void refreshAi();
      setOverlayMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), kind: "user", text },
        {
          id: crypto.randomUUID(),
          kind: "assistant",
          text: "The assistant AI is not ready yet. Wait for it to finish loading, or open **Settings** to download it.",
        },
      ]);
      setMessage("");
      return;
    }

    setMessage("");
    await sendPrompt(text);
  };

  const onDragEnter = (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault();
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const sidebarList =
    activeAccountId != null ? (chatSearchOverride ?? chatsByAccountId[activeAccountId] ?? []) : [];
  const pinnedRows = sidebarList.filter((c) => c.pinned);
  const recentRows = sidebarList.filter((c) => !c.pinned);

  const hasUserMessages = threadItems.some((t) => t.type === "user");
  const showEmptyState = !hasUserMessages && !assistantStreaming;

  const rowSubtitle = (row: AssistantChatRow) => {
    if (row.lastPreview) {
      const t = row.lastPreview.replace(/\s+/g, " ").trim();
      return t.length > 56 ? `${t.slice(0, 53)}…` : t;
    }
    return formatChatListTime(row.lastMessageAt ?? row.updatedAt);
  };

  const onNewChat = async () => {
    if (!activeAccountId || !isDestrallDesktop()) return;
    await createNewChat(activeAccountId);
    textareaRef.current?.focus();
  };

  return (
    <AppShell active="assistant">
      <div className="flex gap-6 h-[calc(100vh-8rem)]">
        {/* Chat column */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <AppLogo variant="mark" size="sm" />
              <h1 className="text-2xl font-bold tracking-tight">Assistant</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void onNewChat()}
                aria-label="New chat"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand text-brand-foreground hover:opacity-90 transition"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setHistoryOpen((o) => !o)}
                aria-label={historyOpen ? "Hide chat history" : "Show chat history"}
                className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-border bg-secondary/40 text-foreground hover:bg-secondary transition"
              >
                {historyOpen ? (
                  <PanelRightClose className="w-4 h-4" />
                ) : (
                  <PanelRightOpen className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div
            className="relative flex-1 flex flex-col min-h-0"
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2 space-y-4">
              {showEmptyState ? (
                <AssistantEmptyState
                  disabled={assistantStreaming || !isLoaded}
                  onSelectPrompt={(prompt) => {
                    setMessage(prompt);
                    void sendPrompt(prompt);
                  }}
                />
              ) : null}
              {isDestrallDesktop() && chatError ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {chatError}
                </div>
              ) : null}
              {threadItems.map((item) => {
                if (item.type === "user") {
                  return (
                    <UserBubble
                      key={item.key}
                      text={item.text}
                      attachments={item.attachments}
                    />
                  );
                }
                if (item.type === "assistant_text") {
                  return <AssistantBubble key={item.key} text={item.text} />;
                }
                if (!activeAccountId) return null;
                return (
                  <AssistantStructuredMessageRenderer
                    key={item.key}
                    accountId={activeAccountId}
                    chatId={item.chatId}
                    messageId={item.messageId}
                    initialMetadata={item.metadata}
                    blocks={item.blocks}
                    onUpdateMessage={async (metadata: string) => {
                      await desktopAssistantChatUpdateMessage({
                        accountId: activeAccountId,
                        chatId: item.chatId,
                        messageId: item.messageId,
                        metadata,
                      });
                    }}
                    onReloadThread={async () => {
                      await loadMessages(activeAccountId, item.chatId);
                    }}
                    onTryPrompt={(prompt) => {
                      setMessage(prompt);
                      void sendPrompt(prompt);
                    }}
                  />
                );
              })}
              {assistantStreaming ? (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-3xl rounded-bl-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating…
                  </div>
                </div>
              ) : null}
            </div>

            {dragActive && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl border-2 border-dashed border-brand bg-brand/10 backdrop-blur-sm pointer-events-none">
                <div className="flex flex-col items-center gap-2 text-brand">
                  <UploadCloud className="w-10 h-10" />
                  <p className="text-sm font-bold uppercase tracking-wider">
                    Drop files to attach
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Images and documents supported
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2 rounded-2xl border border-border bg-card/40 p-2">
                {attachments.map((a) => (
                  <div
                    key={a.id}
                    className="relative group inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 pr-7 pl-1 py-1"
                  >
                    {a.isImage ? (
                      <img
                        src={a.url}
                        alt={a.name}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-secondary/60 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="text-xs leading-tight max-w-[140px]">
                      <p className="font-semibold truncate">{a.name}</p>
                      <p className="text-muted-foreground">{formatBytes(a.size)}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${a.name}`}
                      onClick={() => removeAttachment(a.id)}
                      className="absolute right-1 top-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary text-foreground hover:bg-rose-500/20 hover:text-rose-500 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 rounded-3xl border border-border bg-card/40 px-4 py-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                aria-label="Attach image"
                onClick={() => imageInputRef.current?.click()}
                className="text-muted-foreground hover:text-foreground transition shrink-0 mb-2"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                onPaste={(e) => {
                  const files = Array.from(e.clipboardData.files);
                  if (files.length) {
                    e.preventDefault();
                    addFiles(files);
                  }
                }}
                rows={1}
                placeholder="Ask about portfolio, swaps, risks..."
                className="flex-1 resize-none bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground py-2 max-h-[200px] overflow-y-auto leading-relaxed"
              />
              <button
                type="button"
                aria-label="Attach file"
                onClick={() => fileInputRef.current?.click()}
                className="text-muted-foreground hover:text-foreground transition shrink-0 mb-2"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={assistantStreaming || !isLoaded}
                aria-label="Send message"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand text-brand-foreground hover:opacity-90 transition shrink-0 mb-1"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            {isDestrallDesktop() && !isLoaded ? (
              <div className="mt-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm space-y-3">
                {!isDownloaded ? (
                  <>
                    {runtimeError ? (
                      <p className="text-destructive font-medium" role="alert">
                        {runtimeError}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground">
                      The assistant needs an on-device AI download before you can chat. Downloads stay on this
                      computer.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void downloadModel()}
                        disabled={isDownloading}
                        className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-4 py-2 text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
                      >
                        {isDownloading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : null}
                        Download AI
                      </button>
                      <Link
                        to="/settings"
                        className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary/60 transition"
                      >
                        Open Settings
                      </Link>
                    </div>
                  </>
                ) : isDownloading || isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>{isDownloading ? "Downloading AI…" : "Loading AI…"}</span>
                  </div>
                ) : runtimeError ? (
                  <>
                    <p className="text-destructive font-medium">{runtimeError}</p>
                    <p className="text-muted-foreground">
                      Try reloading the assistant AI. If this keeps happening, open Settings, use Delete AI, then
                      download again.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void loadModel()}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-4 py-2 text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
                      >
                        Reload AI
                      </button>
                      <Link
                        to="/settings"
                        className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary/60 transition"
                      >
                        Open Settings
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground">
                      The assistant AI is installed but not running yet. Reload it to start chatting, or refresh status
                      if you just finished setup on another screen.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void loadModel()}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-4 py-2 text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
                      >
                        Reload AI
                      </button>
                      <button
                        type="button"
                        onClick={() => void refreshAi()}
                        className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary/60 transition"
                      >
                        Refresh status
                      </button>
                      <Link
                        to="/settings"
                        className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary/60 transition"
                      >
                        Open Settings
                      </Link>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Chat history panel */}
        {historyOpen && (
          <>
            <div className="w-px self-stretch bg-border/60" aria-hidden="true" />
            <aside className="w-72 shrink-0 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Chat History</h2>
                <button
                  type="button"
                  onClick={() => void onNewChat()}
                  aria-label="New chat"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand text-brand-foreground hover:opacity-90 transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="relative mb-4">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search chats..."
                  className="w-full rounded-full border border-border bg-card/40 pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-brand transition"
                />
              </div>
              <div className="flex-1 min-h-0 space-y-4 overflow-y-auto overflow-x-visible pr-1 pb-6">
                {!activeAccountId ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Unlock your wallet to see chats.</p>
                ) : sidebarList.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    {search.trim() ? "No chats match your search." : "No chats yet. Start a new chat or send a message."}
                  </p>
                ) : (
                  <>
                    {pinnedRows.length > 0 ? (
                      <div>
                        <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Pinned
                        </p>
                        <div className="space-y-1">
                          {pinnedRows.map((h) => (
                            <HistoryItem
                              key={h.id}
                              row={h}
                              active={h.id === activeChatId}
                              subtitle={rowSubtitle(h)}
                              onSelect={() => {
                                if (!activeAccountId) return;
                                void selectChat(activeAccountId, h.id);
                              }}
                              onPin={() => {
                                if (!activeAccountId) return;
                                void (h.pinned ? unpinChat(activeAccountId, h.id) : pinChat(activeAccountId, h.id));
                              }}
                              onRename={() => setRenameTarget({ id: h.id, title: h.title })}
                              onDelete={() => setDeleteTargetId(h.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {recentRows.length > 0 ? (
                      <div>
                        <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Recent
                        </p>
                        <div className="space-y-1">
                          {recentRows.map((h) => (
                            <HistoryItem
                              key={h.id}
                              row={h}
                              active={h.id === activeChatId}
                              subtitle={rowSubtitle(h)}
                              onSelect={() => {
                                if (!activeAccountId) return;
                                void selectChat(activeAccountId, h.id);
                              }}
                              onPin={() => {
                                if (!activeAccountId) return;
                                void (h.pinned ? unpinChat(activeAccountId, h.id) : pinChat(activeAccountId, h.id));
                              }}
                              onRename={() => setRenameTarget({ id: h.id, title: h.title })}
                              onDelete={() => setDeleteTargetId(h.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </aside>
          </>
        )}
      </div>

      <AlertDialog open={deleteTargetId != null} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the chat and all of its messages for this account. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-rose-600 text-white hover:bg-rose-600/90"
              onClick={() => {
                if (!activeAccountId || !deleteTargetId) return;
                void removeChat(activeAccountId, deleteTargetId).then(() => setDeleteTargetId(null));
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={renameTarget != null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
            <DialogDescription>Choose a short title you will recognize later.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={renameTarget?.title ?? ""}
              onChange={(e) =>
                setRenameTarget((prev) => (prev ? { ...prev, title: e.target.value } : prev))
              }
              placeholder="Chat title"
              className="rounded-xl"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-sm font-medium border border-border hover:bg-secondary transition"
              onClick={() => setRenameTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-sm font-bold bg-brand text-brand-foreground hover:opacity-90 transition"
              onClick={() => {
                if (!activeAccountId || !renameTarget) return;
                const t = renameTarget.title.trim();
                if (!t) return;
                void renameChat(activeAccountId, renameTarget.id, t).then(() => setRenameTarget(null));
              }}
            >
              Save
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
