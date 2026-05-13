import { ipcMain } from "electron";
import { z } from "zod";
import type { AssistantChatRow, AssistantMessageRow } from "../../shared/assistantChat";
import type { RpcResult } from "../../shared/ipc";
import { IPCChannels } from "../../shared/ipc";
import { chatHistoryService } from "../services/assistant/chatHistoryService";
import { resolveAssistantContactDisambiguation } from "../services/assistant/assistantContactDisambiguationService";

function ok<T>(data: T): RpcResult<T> {
  return { ok: true, data };
}

function fail(error: unknown): RpcResult<never> {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return { ok: false, error: message };
}

const accountId = z.string().min(1);
const chatId = z.string().min(1);

export function registerAssistantChatIpcHandlers() {
  ipcMain.handle(IPCChannels.assistantChatList, async (_e, payload: unknown) => {
    try {
      const id = accountId.parse(payload);
      return ok(chatHistoryService.getChats(id) as AssistantChatRow[]);
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.assistantChatSearch, async (_e, payload: unknown) => {
    try {
      const parsed = z.object({ accountId: accountId, query: z.string() }).parse(payload);
      return ok(chatHistoryService.searchChats(parsed.accountId, parsed.query) as AssistantChatRow[]);
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.assistantChatCreate, async (_e, payload: unknown) => {
    try {
      const parsed = z.object({ accountId: accountId, title: z.string().max(200).optional() }).parse(payload);
      return ok(chatHistoryService.createChat(parsed.accountId, parsed.title));
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.assistantChatGet, async (_e, payload: unknown) => {
    try {
      const parsed = z.object({ accountId: accountId, chatId: chatId }).parse(payload);
      const row = chatHistoryService.getChatById(parsed.accountId, parsed.chatId);
      if (!row) return fail(new Error("Chat not found"));
      return ok(row);
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.assistantChatRename, async (_e, payload: unknown) => {
    try {
      const parsed = z
        .object({ accountId: accountId, chatId: chatId, title: z.string().min(1).max(200) })
        .parse(payload);
      const row = chatHistoryService.updateChatTitle(parsed.accountId, parsed.chatId, parsed.title);
      if (!row) return fail(new Error("Chat not found"));
      return ok(row);
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.assistantChatPin, async (_e, payload: unknown) => {
    try {
      const parsed = z.object({ accountId: accountId, chatId: chatId }).parse(payload);
      const row = chatHistoryService.pinChat(parsed.accountId, parsed.chatId);
      if (!row) return fail(new Error("Chat not found"));
      return ok(row);
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.assistantChatUnpin, async (_e, payload: unknown) => {
    try {
      const parsed = z.object({ accountId: accountId, chatId: chatId }).parse(payload);
      const row = chatHistoryService.unpinChat(parsed.accountId, parsed.chatId);
      if (!row) return fail(new Error("Chat not found"));
      return ok(row);
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.assistantChatDelete, async (_e, payload: unknown) => {
    try {
      const parsed = z.object({ accountId: accountId, chatId: chatId }).parse(payload);
      const active = chatHistoryService.getActiveChatId(parsed.accountId);
      const deleted = chatHistoryService.deleteChat(parsed.accountId, parsed.chatId);
      if (!deleted) return fail(new Error("Chat not found"));
      if (active === parsed.chatId) {
        const next = chatHistoryService.getChats(parsed.accountId)[0];
        chatHistoryService.setActiveChatId(parsed.accountId, next?.id ?? null);
      }
      return ok({ ok: true as const });
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.assistantChatMessages, async (_e, payload: unknown) => {
    try {
      const parsed = z.object({ accountId: accountId, chatId: chatId }).parse(payload);
      return ok(chatHistoryService.getMessages(parsed.accountId, parsed.chatId) as AssistantMessageRow[]);
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.assistantChatUpdateMessage, async (_e, payload: unknown) => {
    try {
      const parsed = z
        .object({
          accountId: accountId,
          chatId: chatId,
          messageId: z.string().min(1),
          content: z.string().max(200000).optional(),
          metadata: z.string().max(50000).nullable().optional(),
        })
        .parse(payload);
      const row = chatHistoryService.updateMessage(
        parsed.accountId,
        parsed.chatId,
        parsed.messageId,
        {
          content: parsed.content,
          metadata: parsed.metadata,
        },
      );
      if (!row) return fail(new Error("Message not found"));
      return ok(row);
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.assistantChatAddMessage, async (_e, payload: unknown) => {
    try {
      const parsed = z
        .object({
          accountId: accountId,
          chatId: chatId,
          role: z.string().min(1).max(32),
          content: z.string().max(200000),
          metadata: z.string().max(50000).nullable().optional(),
        })
        .parse(payload);
      return ok(
        chatHistoryService.addMessage(parsed.accountId, parsed.chatId, {
          role: parsed.role,
          content: parsed.content,
          metadata: parsed.metadata,
        }),
      );
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.assistantChatGetActive, async (_e, payload: unknown) => {
    try {
      const id = accountId.parse(payload);
      return ok(chatHistoryService.getActiveChatId(id));
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.assistantChatSetActive, async (_e, payload: unknown) => {
    try {
      const parsed = z
        .object({ accountId: accountId, chatId: z.union([z.string().min(1), z.null()]) })
        .parse(payload);
      chatHistoryService.setActiveChatId(parsed.accountId, parsed.chatId);
      return ok({ ok: true as const });
    } catch (error) {
      return fail(error);
    }
  });

  const resolveContactDisambiguationSchema = z.object({
    accountId: z.string().min(1),
    chatId: z.string().min(1),
    messageId: z.string().min(1),
    disambiguationId: z.string().min(1),
    pickedMatchId: z.string().min(1),
  });

  ipcMain.handle(IPCChannels.assistantChatResolveContactDisambiguation, async (_e, payload: unknown) => {
    try {
      const parsed = resolveContactDisambiguationSchema.parse(payload);
      const row = await resolveAssistantContactDisambiguation({
        accountId: parsed.accountId,
        chatId: parsed.chatId,
        messageId: parsed.messageId,
        disambiguationId: parsed.disambiguationId,
        pickedMatchId: parsed.pickedMatchId,
      });
      return ok(row as AssistantMessageRow);
    } catch (error) {
      return fail(error);
    }
  });
}
