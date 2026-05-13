import type { AssistantChatRow, AssistantMessageRow } from "../../shared/assistantChat";
import type { RpcResult } from "../../shared/ipc";

function api() {
  if (typeof window === "undefined" || !window.destrallApi) {
    throw new Error("Destrall API is not available in this context.");
  }
  return window.destrallApi;
}

async function unwrap<T>(result: Promise<RpcResult<T>>): Promise<T> {
  const response = await result;
  if (response.ok === false) {
    throw new Error(response.error);
  }
  return response.data;
}

export async function desktopAssistantChatList(accountId: string): Promise<AssistantChatRow[]> {
  return unwrap(api().assistantChat.list(accountId));
}

export async function desktopAssistantChatSearch(payload: {
  accountId: string;
  query: string;
}): Promise<AssistantChatRow[]> {
  return unwrap(api().assistantChat.search(payload));
}

export async function desktopAssistantChatCreate(payload: {
  accountId: string;
  title?: string;
}): Promise<AssistantChatRow> {
  return unwrap(api().assistantChat.create(payload));
}

export async function desktopAssistantChatGet(payload: {
  accountId: string;
  chatId: string;
}): Promise<AssistantChatRow> {
  return unwrap(api().assistantChat.get(payload));
}

export async function desktopAssistantChatRename(payload: {
  accountId: string;
  chatId: string;
  title: string;
}): Promise<AssistantChatRow> {
  return unwrap(api().assistantChat.rename(payload));
}

export async function desktopAssistantChatPin(payload: {
  accountId: string;
  chatId: string;
}): Promise<AssistantChatRow> {
  return unwrap(api().assistantChat.pin(payload));
}

export async function desktopAssistantChatUnpin(payload: {
  accountId: string;
  chatId: string;
}): Promise<AssistantChatRow> {
  return unwrap(api().assistantChat.unpin(payload));
}

export async function desktopAssistantChatDelete(payload: {
  accountId: string;
  chatId: string;
}): Promise<void> {
  await unwrap(api().assistantChat.delete(payload));
}

export async function desktopAssistantChatMessages(payload: {
  accountId: string;
  chatId: string;
}): Promise<AssistantMessageRow[]> {
  return unwrap(api().assistantChat.messages(payload));
}

export async function desktopAssistantChatAddMessage(payload: {
  accountId: string;
  chatId: string;
  role: string;
  content: string;
  metadata?: string | null;
}): Promise<AssistantMessageRow> {
  return unwrap(api().assistantChat.addMessage(payload));
}

export async function desktopAssistantChatUpdateMessage(payload: {
  accountId: string;
  chatId: string;
  messageId: string;
  content?: string;
  metadata?: string | null;
}): Promise<AssistantMessageRow> {
  return unwrap(api().assistantChat.updateMessage(payload));
}

export async function desktopAssistantChatGetActive(accountId: string): Promise<string | null> {
  return unwrap(api().assistantChat.getActive(accountId));
}

export async function desktopAssistantChatSetActive(payload: {
  accountId: string;
  chatId: string | null;
}): Promise<void> {
  await unwrap(api().assistantChat.setActive(payload));
}
