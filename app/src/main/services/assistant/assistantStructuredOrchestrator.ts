import type { AssistantStructuredResult } from "../../../assistant/assistantResultTypes";
import { planAssistantStructuredTurn } from "../../../assistant/intentPlanner";

export { planAssistantStructuredTurn } from "../../../assistant/intentPlanner";

/**
 * Back-compat: structured blocks + optional LLM addendum (empty when the planner answered deterministically).
 */
export async function buildAssistantStructuredBlocks(
  accountId: string,
  userText: string,
  chatId?: string,
): Promise<{ blocks: AssistantStructuredResult[]; systemAddendum: string }> {
  const plan = await planAssistantStructuredTurn(accountId, userText, { chatId });
  if (plan.mode === "deterministic") {
    return { blocks: plan.blocks, systemAddendum: "" };
  }
  return { blocks: plan.blocks, systemAddendum: plan.systemAddendum };
}
