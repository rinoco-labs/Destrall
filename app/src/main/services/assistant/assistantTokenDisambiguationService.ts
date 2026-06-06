import type { AssistantStructuredResult } from "../../../assistant/assistantResultTypes";
import {
  parseAssistantMessageMetadata,
  serializeAssistantMessageMetadata,
} from "../../../assistant/assistantMessageMetadata";
import { PREPARE_SEND_ACTION_NAME } from "../../../assistant/assistantFunctionSchemas";
import { executePackageAction } from "../../../packages/runtime/actionExecutor";
import { chatHistoryService } from "./chatHistoryService";

/**
 * Replace a `token_disambiguation` block with the result of the resumed action for the chosen coin type.
 */
export async function resolveAssistantTokenDisambiguation(params: {
  accountId: string;
  chatId: string;
  messageId: string;
  disambiguationId: string;
  pickedCoinType: string;
}) {
  const messages = chatHistoryService.getMessages(params.accountId, params.chatId);
  const message = messages.find((m) => m.id === params.messageId);
  if (!message?.metadata) {
    throw new Error("Message not found or has no structured metadata.");
  }

  const blocks = parseAssistantMessageMetadata(message.metadata);
  const idx = blocks.findIndex(
    (b) => b.type === "token_disambiguation" && b.disambiguationId === params.disambiguationId,
  );
  if (idx < 0) {
    throw new Error("Token disambiguation card not found or already resolved.");
  }

  const block = blocks[idx];
  if (block.type !== "token_disambiguation") {
    throw new Error("Invalid structured block.");
  }

  const allowed = new Set(block.matches.map((m) => m.coinType));
  if (!allowed.has(params.pickedCoinType)) {
    throw new Error("That token is not part of this disambiguation.");
  }

  let prepBlocks: AssistantStructuredResult[] = [];
  if (block.action === "send") {
    const pending = block.pendingInput;
    prepBlocks = await executePackageAction({
      accountId: params.accountId,
      namespacedName: PREPARE_SEND_ACTION_NAME,
      input: {
        ...pending,
        coinType: params.pickedCoinType,
      },
    });
  } else {
    throw new Error(`Token disambiguation for action "${block.action}" is not wired yet.`);
  }

  const next: AssistantStructuredResult[] = [...blocks];
  next.splice(idx, 1, ...prepBlocks);
  const metadata = serializeAssistantMessageMetadata(next);
  const row = chatHistoryService.updateMessage(params.accountId, params.chatId, params.messageId, {
    metadata,
  });
  if (!row) {
    throw new Error("Could not update assistant message.");
  }
  return row;
}
