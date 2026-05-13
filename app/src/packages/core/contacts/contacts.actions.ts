import type { AssistantStructuredResult } from "../../../assistant/assistantResultTypes";
import type { ActionContext } from "../../runtime/actionContext";

/**
 * Read-only contact search for future tool-calling; does not render chat cards.
 */
export async function searchContactsAction(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  const query = typeof input.query === "string" ? input.query : "";
  const rows = await ctx.contacts.searchContacts(query);
  void rows;
  return [];
}
