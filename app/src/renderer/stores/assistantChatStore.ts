import { create } from "zustand";
import type { AssistantChatRow, AssistantMessageRow } from "../../shared/assistantChat";
import type { AssistantChatTurn } from "../../shared/ipc";
import {
  desktopAssistantChatAddMessage,
  desktopAssistantChatCreate,
  desktopAssistantChatDelete,
  desktopAssistantChatGetActive,
  desktopAssistantChatList,
  desktopAssistantChatMessages,
  desktopAssistantChatRename,
  desktopAssistantChatSearch,
  desktopAssistantChatSetActive,
  desktopAssistantChatPin,
  desktopAssistantChatUnpin,
} from "@/lib/desktopAssistantChat";
import { useAiModelStore } from "@/stores/aiModelStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { isDestrallDesktop } from "@/lib/desktopWallet";

function titleFromUserMessage(text: string, maxWords = 6): string {
  const words = text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords);
  const t = words.join(" ");
  if (!t) return "New Chat";
  return t.length > 80 ? `${t.slice(0, 77)}…` : t;
}

function msgKey(accountId: string, chatId: string) {
  return `${accountId}:${chatId}`;
}

type StreamingContext = { accountId: string; chatId: string };

export type AssistantChatStoreState = {
  activeAccountId: string | null;
  chatsByAccountId: Record<string, AssistantChatRow[]>;
  activeChatIdByAccountId: Record<string, string | null>;
  messagesByChatId: Record<string, AssistantMessageRow[]>;
  searchQuery: string;
  chatSearchOverride: AssistantChatRow[] | null;
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  assistantStreaming: boolean;
  streamingContext: StreamingContext | null;
  error: string | null;

  initializeForAccount: (accountId: string | null) => Promise<void>;
  createNewChat: (accountId: string) => Promise<string>;
  selectChat: (accountId: string, chatId: string) => Promise<void>;
  sendMessage: (accountId: string, chatId: string | null, text: string) => Promise<void>;
  loadChats: (accountId: string) => Promise<void>;
  loadMessages: (accountId: string, chatId: string) => Promise<void>;
  searchChats: (accountId: string, query: string) => Promise<void>;
  pinChat: (accountId: string, chatId: string) => Promise<void>;
  unpinChat: (accountId: string, chatId: string) => Promise<void>;
  deleteChat: (accountId: string, chatId: string) => Promise<void>;
  renameChat: (accountId: string, chatId: string, title: string) => Promise<void>;
  clearAccountChatState: (accountId: string) => void;
  setSearchQuery: (query: string) => void;
};

export const useAssistantChatStore = create<AssistantChatStoreState>((set, get) => ({
  activeAccountId: null,
  chatsByAccountId: {},
  activeChatIdByAccountId: {},
  messagesByChatId: {},
  searchQuery: "",
  chatSearchOverride: null,
  isLoadingChats: false,
  isLoadingMessages: false,
  assistantStreaming: false,
  streamingContext: null,
  error: null,

  setSearchQuery: (query) => set({ searchQuery: query }),

  clearAccountChatState: (accountId) => {
    const { chatsByAccountId, activeChatIdByAccountId, messagesByChatId } = get();
    const nextChats = { ...chatsByAccountId };
    delete nextChats[accountId];
    const nextActive = { ...activeChatIdByAccountId };
    delete nextActive[accountId];
    const nextMsgs = { ...messagesByChatId };
    for (const k of Object.keys(nextMsgs)) {
      if (k.startsWith(`${accountId}:`)) delete nextMsgs[k];
    }
    set({ chatsByAccountId: nextChats, activeChatIdByAccountId: nextActive, messagesByChatId: nextMsgs });
  },

  initializeForAccount: async (accountId) => {
    set({
      assistantStreaming: false,
      streamingContext: null,
      error: null,
      chatSearchOverride: null,
      searchQuery: "",
    });
    if (!accountId || !isDestrallDesktop()) {
      set({ activeAccountId: null, isLoadingChats: false });
      return;
    }
    set({ activeAccountId: accountId, isLoadingChats: true });
    try {
      const chats = await desktopAssistantChatList(accountId);
      const activeSaved = await desktopAssistantChatGetActive(accountId);
      const activeExists = activeSaved && chats.some((c) => c.id === activeSaved);
      const activeChatId = activeExists ? activeSaved : null;
      set((s) => ({
        chatsByAccountId: { ...s.chatsByAccountId, [accountId]: chats },
        activeChatIdByAccountId: { ...s.activeChatIdByAccountId, [accountId]: activeChatId },
        isLoadingChats: false,
      }));
      if (activeChatId) {
        await get().loadMessages(accountId, activeChatId);
      } else {
        set((s) => {
          const next = { ...s.messagesByChatId };
          for (const k of Object.keys(next)) {
            if (k.startsWith(`${accountId}:`)) delete next[k];
          }
          return { messagesByChatId: next };
        });
      }
    } catch (e) {
      set({
        isLoadingChats: false,
        error: e instanceof Error ? e.message : "Failed to load chats",
      });
    }
  },

  loadChats: async (accountId) => {
    if (!isDestrallDesktop()) return;
    set({ isLoadingChats: true, error: null, chatSearchOverride: null });
    try {
      const chats = await desktopAssistantChatList(accountId);
      set((s) => ({
        chatsByAccountId: { ...s.chatsByAccountId, [accountId]: chats },
        isLoadingChats: false,
      }));
    } catch (e) {
      set({
        isLoadingChats: false,
        error: e instanceof Error ? e.message : "Failed to load chats",
      });
    }
  },

  loadMessages: async (accountId, chatId) => {
    if (!isDestrallDesktop()) return;
    set({ isLoadingMessages: true, error: null });
    try {
      const rows = await desktopAssistantChatMessages({ accountId, chatId });
      const key = msgKey(accountId, chatId);
      set((s) => ({
        messagesByChatId: { ...s.messagesByChatId, [key]: rows },
        isLoadingMessages: false,
      }));
    } catch (e) {
      set({
        isLoadingMessages: false,
        error: e instanceof Error ? e.message : "Failed to load messages",
      });
    }
  },

  searchChats: async (accountId, query) => {
    set({ searchQuery: query });
    if (!isDestrallDesktop()) return;
    const q = query.trim();
    if (q === "") {
      set({ chatSearchOverride: null });
      await get().loadChats(accountId);
      return;
    }
    try {
      const rows = await desktopAssistantChatSearch({ accountId, query: q });
      set({ chatSearchOverride: rows });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Search failed" });
    }
  },

  createNewChat: async (accountId) => {
    if (!isDestrallDesktop()) throw new Error("Assistant requires desktop app");
    const chat = await desktopAssistantChatCreate({ accountId, title: "New Chat" });
    await desktopAssistantChatSetActive({ accountId, chatId: chat.id });
    set((s) => ({
      activeChatIdByAccountId: { ...s.activeChatIdByAccountId, [accountId]: chat.id },
      chatSearchOverride: null,
      searchQuery: "",
    }));
    set((s) => ({
      messagesByChatId: { ...s.messagesByChatId, [msgKey(accountId, chat.id)]: [] },
    }));
    await get().loadChats(accountId);
    return chat.id;
  },

  selectChat: async (accountId, chatId) => {
    if (!isDestrallDesktop()) return;
    await desktopAssistantChatSetActive({ accountId, chatId });
    set((s) => ({
      activeChatIdByAccountId: { ...s.activeChatIdByAccountId, [accountId]: chatId },
    }));
    await get().loadMessages(accountId, chatId);
  },

  pinChat: async (accountId, chatId) => {
    const row = await desktopAssistantChatPin({ accountId, chatId });
    set((s) => {
      const list = s.chatsByAccountId[accountId] ?? [];
      const next = list.map((c) => (c.id === row.id ? row : c));
      let override = s.chatSearchOverride;
      if (override) {
        override = override.map((c) => (c.id === row.id ? row : c));
      }
      return {
        chatsByAccountId: { ...s.chatsByAccountId, [accountId]: next },
        chatSearchOverride: override,
      };
    });
  },

  unpinChat: async (accountId, chatId) => {
    const row = await desktopAssistantChatUnpin({ accountId, chatId });
    set((s) => {
      const list = s.chatsByAccountId[accountId] ?? [];
      const next = list.map((c) => (c.id === row.id ? row : c));
      let override = s.chatSearchOverride;
      if (override) {
        override = override.map((c) => (c.id === row.id ? row : c));
      }
      return {
        chatsByAccountId: { ...s.chatsByAccountId, [accountId]: next },
        chatSearchOverride: override,
      };
    });
  },

  renameChat: async (accountId, chatId, title) => {
    const row = await desktopAssistantChatRename({ accountId, chatId, title });
    set((s) => {
      const list = s.chatsByAccountId[accountId] ?? [];
      const next = list.map((c) => (c.id === row.id ? row : c));
      let override = s.chatSearchOverride;
      if (override) {
        override = override.map((c) => (c.id === row.id ? row : c));
      }
      return {
        chatsByAccountId: { ...s.chatsByAccountId, [accountId]: next },
        chatSearchOverride: override,
      };
    });
  },

  deleteChat: async (accountId, chatId) => {
    await desktopAssistantChatDelete({ accountId, chatId });
    set((s) => {
      const key = msgKey(accountId, chatId);
      const nextMsgs = { ...s.messagesByChatId };
      delete nextMsgs[key];
      return { messagesByChatId: nextMsgs };
    });
    await get().loadChats(accountId);
    const nextActive = (await desktopAssistantChatGetActive(accountId)) ?? null;
    set((s) => ({
      activeChatIdByAccountId: { ...s.activeChatIdByAccountId, [accountId]: nextActive },
    }));
    if (nextActive) {
      await get().loadMessages(accountId, nextActive);
    }
  },

  sendMessage: async (accountId, chatId, text) => {
    if (!isDestrallDesktop()) throw new Error("Assistant requires desktop app");
    const trimmed = text.trim();
    if (!trimmed) return;

    let cid = chatId;
    if (!cid) {
      cid = await get().createNewChat(accountId);
    }

    const streamCtx: StreamingContext = { accountId, chatId: cid };
    set({ assistantStreaming: true, streamingContext: streamCtx });

    const priorCount = (
      get().messagesByChatId[msgKey(accountId, cid)]?.filter((m) => m.role === "user") ?? []
    ).length;

    try {
      await desktopAssistantChatAddMessage({
        accountId,
        chatId: cid,
        role: "user",
        content: trimmed,
      });
      await get().loadMessages(accountId, cid);
      await get().loadChats(accountId);

      const chatRow = get().chatsByAccountId[accountId]?.find((c) => c.id === cid);
      if (chatRow?.title === "New Chat" && priorCount === 0) {
        const newTitle = titleFromUserMessage(trimmed);
        await get().renameChat(accountId, cid, newTitle);
      }

      const rows = get().messagesByChatId[msgKey(accountId, cid)] ?? [];
      const turns: AssistantChatTurn[] = rows
        .filter((r) => r.role === "user" || r.role === "assistant")
        .map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));

      const language = useSettingsStore.getState().language;
      const personalityId = useSettingsStore.getState().aiPersonality;

      const reply = await useAiModelStore.getState().sendMessage({
        messages: turns,
        accountId,
        language,
        personalityId,
      });

      await desktopAssistantChatAddMessage({
        accountId,
        chatId: cid,
        role: "assistant",
        content: reply,
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : "The model failed to respond.";
      await desktopAssistantChatAddMessage({
        accountId,
        chatId: cid,
        role: "assistant",
        content: `**Error**\n${err}`,
      });
    } finally {
      await get().loadMessages(accountId, cid);
      await get().loadChats(accountId);
      const s = get();
      if (
        s.streamingContext?.accountId === streamCtx.accountId &&
        s.streamingContext?.chatId === streamCtx.chatId
      ) {
        set({ assistantStreaming: false, streamingContext: null });
      }
    }
  },
}));
