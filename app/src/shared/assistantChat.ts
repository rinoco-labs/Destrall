/** Assistant chat persistence DTOs (shared between main IPC and renderer). */

export type AssistantChatRow = {
  id: string;
  accountId: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  lastPreview: string | null;
};

export type AssistantMessageRow = {
  id: string;
  chatId: string;
  accountId: string;
  role: string;
  content: string;
  metadata: string | null;
  createdAt: string;
};
