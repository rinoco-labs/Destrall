import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { AssistantChatRow, AssistantMessageRow } from "../../../shared/assistantChat";
import { getDatabase } from "../../persistence/database";

export type PersistedAssistantChat = AssistantChatRow;
export type PersistedAssistantMessage = AssistantMessageRow;

const ACTIVE_CHAT_KEY = (accountId: string) => `assistant_active_chat:${accountId}`;

type ChatRow = {
  id: string;
  accountId: string;
  title: string;
  pinned: number;
  archived: number;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  lastPreview: string | null;
};

type MessageRow = {
  id: string;
  chatId: string;
  accountId: string;
  role: string;
  content: string;
  metadata: string | null;
  createdAt: string;
};

function mapChat(row: ChatRow): PersistedAssistantChat {
  return {
    id: row.id,
    accountId: row.accountId,
    title: row.title,
    pinned: row.pinned === 1,
    archived: row.archived === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastMessageAt: row.lastMessageAt,
    lastPreview: row.lastPreview,
  };
}

function mapMessage(row: MessageRow): PersistedAssistantMessage {
  return {
    id: row.id,
    chatId: row.chatId,
    accountId: row.accountId,
    role: row.role,
    content: row.content,
    metadata: row.metadata,
    createdAt: row.createdAt,
  };
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Assistant chat persistence. Every mutating method requires accountId and
 * scopes SQL with account_id so chats never cross accounts.
 */
export class ChatHistoryService {
  constructor(private readonly db: DatabaseSync) {}

  private getChatAccountId(chatId: string): string | null {
    const row = this.db
      .prepare(`SELECT account_id AS accountId FROM assistant_chats WHERE id = ?`)
      .get(chatId) as { accountId: string } | undefined;
    return row?.accountId ?? null;
  }

  createChat(accountId: string, title = "New Chat"): PersistedAssistantChat {
    const id = randomUUID();
    const ts = nowIso();
    const t = title.trim() || "New Chat";
    this.db
      .prepare(
        `INSERT INTO assistant_chats (id, account_id, title, pinned, archived, created_at, updated_at, last_message_at)
         VALUES (?, ?, ?, 0, 0, ?, ?, NULL)`,
      )
      .run(id, accountId, t, ts, ts);
    const created = this.getChatById(accountId, id);
    if (!created) throw new Error("Failed to create chat");
    return created;
  }

  getChats(accountId: string): PersistedAssistantChat[] {
    const rows = this.db
      .prepare(
        `SELECT c.id, c.account_id AS accountId, c.title, c.pinned, c.archived,
                c.created_at AS createdAt, c.updated_at AS updatedAt, c.last_message_at AS lastMessageAt,
                (SELECT sm.content FROM assistant_messages sm
                 WHERE sm.chat_id = c.id AND sm.account_id = c.account_id
                 ORDER BY sm.created_at DESC LIMIT 1) AS lastPreview
         FROM assistant_chats c
         WHERE c.account_id = ? AND c.archived = 0
         ORDER BY c.pinned DESC,
                  datetime(COALESCE(c.last_message_at, c.updated_at, c.created_at)) DESC,
                  datetime(c.updated_at) DESC`,
      )
      .all(accountId) as ChatRow[];
    return rows.map(mapChat);
  }

  getChatById(accountId: string, chatId: string): PersistedAssistantChat | null {
    const row = this.db
      .prepare(
        `SELECT c.id, c.account_id AS accountId, c.title, c.pinned, c.archived,
                c.created_at AS createdAt, c.updated_at AS updatedAt, c.last_message_at AS lastMessageAt,
                (SELECT sm.content FROM assistant_messages sm
                 WHERE sm.chat_id = c.id AND sm.account_id = c.account_id
                 ORDER BY sm.created_at DESC LIMIT 1) AS lastPreview
         FROM assistant_chats c
         WHERE c.id = ? AND c.account_id = ?`,
      )
      .get(chatId, accountId) as ChatRow | undefined;
    return row ? mapChat(row) : null;
  }

  searchChats(accountId: string, query: string): PersistedAssistantChat[] {
    const q = query.trim();
    if (q === "") {
      return this.getChats(accountId);
    }
    const like = `%${q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    const rows = this.db
      .prepare(
        `SELECT DISTINCT c.id, c.account_id AS accountId, c.title, c.pinned, c.archived,
                c.created_at AS createdAt, c.updated_at AS updatedAt, c.last_message_at AS lastMessageAt,
                (SELECT sm.content FROM assistant_messages sm
                 WHERE sm.chat_id = c.id AND sm.account_id = c.account_id
                 ORDER BY sm.created_at DESC LIMIT 1) AS lastPreview
         FROM assistant_chats c
         LEFT JOIN assistant_messages m ON m.chat_id = c.id AND m.account_id = c.account_id
         WHERE c.account_id = ? AND c.archived = 0
           AND (c.title LIKE ? ESCAPE '\\' OR m.content LIKE ? ESCAPE '\\')
         ORDER BY c.pinned DESC,
                  datetime(COALESCE(c.last_message_at, c.updated_at, c.created_at)) DESC,
                  datetime(c.updated_at) DESC`,
      )
      .all(accountId, like, like) as ChatRow[];
    return rows.map(mapChat);
  }

  updateChatTitle(accountId: string, chatId: string, title: string): PersistedAssistantChat | null {
    const owner = this.getChatAccountId(chatId);
    if (owner !== accountId) return null;
    const ts = nowIso();
    const t = title.trim().slice(0, 200) || "New Chat";
    this.db
      .prepare(`UPDATE assistant_chats SET title = ?, updated_at = ? WHERE id = ? AND account_id = ?`)
      .run(t, ts, chatId, accountId);
    return this.getChatById(accountId, chatId);
  }

  pinChat(accountId: string, chatId: string): PersistedAssistantChat | null {
    const owner = this.getChatAccountId(chatId);
    if (owner !== accountId) return null;
    const ts = nowIso();
    this.db
      .prepare(`UPDATE assistant_chats SET pinned = 1, updated_at = ? WHERE id = ? AND account_id = ?`)
      .run(ts, chatId, accountId);
    return this.getChatById(accountId, chatId);
  }

  unpinChat(accountId: string, chatId: string): PersistedAssistantChat | null {
    const owner = this.getChatAccountId(chatId);
    if (owner !== accountId) return null;
    const ts = nowIso();
    this.db
      .prepare(`UPDATE assistant_chats SET pinned = 0, updated_at = ? WHERE id = ? AND account_id = ?`)
      .run(ts, chatId, accountId);
    return this.getChatById(accountId, chatId);
  }

  deleteChat(accountId: string, chatId: string): boolean {
    const owner = this.getChatAccountId(chatId);
    if (owner !== accountId) return false;
    const info = this.db
      .prepare(`DELETE FROM assistant_chats WHERE id = ? AND account_id = ?`)
      .run(chatId, accountId);
    return info.changes > 0;
  }

  updateMessage(
    accountId: string,
    chatId: string,
    messageId: string,
    updates: { content?: string; metadata?: string | null },
  ): PersistedAssistantMessage | null {
    const owner = this.getChatAccountId(chatId);
    if (owner !== accountId) return null;
    const existing = this.db
      .prepare(
        `SELECT id, chat_id AS chatId, account_id AS accountId, role, content, metadata, created_at AS createdAt
         FROM assistant_messages WHERE id = ? AND account_id = ? AND chat_id = ?`,
      )
      .get(messageId, accountId, chatId) as MessageRow | undefined;
    if (!existing) return null;
    const content = updates.content !== undefined ? updates.content : existing.content;
    const metadata = updates.metadata !== undefined ? updates.metadata : existing.metadata;
    this.db
      .prepare(`UPDATE assistant_messages SET content = ?, metadata = ? WHERE id = ? AND account_id = ?`)
      .run(content, metadata, messageId, accountId);
    const row = this.db
      .prepare(
        `SELECT id, chat_id AS chatId, account_id AS accountId, role, content, metadata, created_at AS createdAt
         FROM assistant_messages WHERE id = ? AND account_id = ?`,
      )
      .get(messageId, accountId) as MessageRow | undefined;
    return row ? mapMessage(row) : null;
  }

  addMessage(
    accountId: string,
    chatId: string,
    message: { role: string; content: string; metadata?: string | null },
  ): PersistedAssistantMessage {
    const owner = this.getChatAccountId(chatId);
    if (owner !== accountId) {
      throw new Error("Chat not found for this account");
    }
    const id = randomUUID();
    const ts = nowIso();
    const meta = message.metadata ?? null;
    this.db
      .prepare(
        `INSERT INTO assistant_messages (id, chat_id, account_id, role, content, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, chatId, accountId, message.role, message.content, meta, ts);
    this.updateLastMessageAt(accountId, chatId, ts);
    const inserted = this.db
      .prepare(
        `SELECT id, chat_id AS chatId, account_id AS accountId, role, content, metadata, created_at AS createdAt
         FROM assistant_messages WHERE id = ? AND account_id = ?`,
      )
      .get(id, accountId) as MessageRow | undefined;
    if (!inserted) throw new Error("Failed to read inserted message");
    return mapMessage(inserted);
  }

  getMessages(accountId: string, chatId: string): PersistedAssistantMessage[] {
    const owner = this.getChatAccountId(chatId);
    if (owner !== accountId) {
      return [];
    }
    const rows = this.db
      .prepare(
        `SELECT id, chat_id AS chatId, account_id AS accountId, role, content, metadata, created_at AS createdAt
         FROM assistant_messages
         WHERE chat_id = ? AND account_id = ?
         ORDER BY datetime(created_at) ASC`,
      )
      .all(chatId, accountId) as MessageRow[];
    return rows.map(mapMessage);
  }

  updateLastMessageAt(accountId: string, chatId: string, atIso?: string): void {
    const owner = this.getChatAccountId(chatId);
    if (owner !== accountId) return;
    const ts = atIso ?? nowIso();
    this.db
      .prepare(
        `UPDATE assistant_chats SET last_message_at = ?, updated_at = ? WHERE id = ? AND account_id = ?`,
      )
      .run(ts, ts, chatId, accountId);
  }

  getActiveChatId(accountId: string): string | null {
    const row = this.db
      .prepare(`SELECT value FROM app_settings WHERE key = ?`)
      .get(ACTIVE_CHAT_KEY(accountId)) as { value: string } | undefined;
    const id = row?.value;
    if (!id) return null;
    return this.getChatById(accountId, id) ? id : null;
  }

  setActiveChatId(accountId: string, chatId: string | null): void {
    const key = ACTIVE_CHAT_KEY(accountId);
    const now = Date.now();
    if (chatId == null) {
      this.db.prepare(`DELETE FROM app_settings WHERE key = ?`).run(key);
      return;
    }
    if (!this.getChatById(accountId, chatId)) {
      throw new Error("Cannot set active chat: not found for account");
    }
    this.db
      .prepare(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, chatId, now);
  }
}

export const chatHistoryService = new ChatHistoryService(getDatabase());
