import type { ContactRow, RpcResult } from "../../shared/ipc";
import type { ChainId } from "../../shared/wallet/types";

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

export async function desktopListContacts(query?: string): Promise<ContactRow[]> {
  return unwrap(api().contacts.list({ query }));
}

export async function desktopCreateContact(payload: {
  name: string;
  address: string;
  chain: ChainId;
  accountId?: string | null;
}): Promise<ContactRow> {
  return unwrap(api().contacts.create(payload));
}

export async function desktopUpdateContact(payload: {
  id: string;
  name: string;
  address: string;
}): Promise<ContactRow> {
  return unwrap(api().contacts.update(payload));
}

export async function desktopDeleteContact(id: string): Promise<void> {
  await unwrap(api().contacts.delete({ id }));
}
