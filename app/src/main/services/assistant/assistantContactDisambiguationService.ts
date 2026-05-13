import type { AssistantStructuredResult } from "../../../assistant/assistantResultTypes";
import {
  parseAssistantMessageMetadata,
  serializeAssistantMessageMetadata,
} from "../../../assistant/assistantMessageMetadata";
import { PREPARE_SEND_ACTION_NAME } from "../../../assistant/assistantFunctionSchemas";
import { executePackageAction } from "../../../packages/runtime/actionExecutor";
import { contactRepository } from "../../persistence/repositories/contactRepository";
import { walletService } from "../../wallet/walletService";
import { chatHistoryService } from "./chatHistoryService";
import { tryParseSuiAddress } from "../../../services/contacts/contactResolutionService";

function resolvePickAddress(pickedId: string): string | null {
  const contact = contactRepository.getById(pickedId);
  if (contact) {
    return tryParseSuiAddress(contact.address);
  }
  const account = walletService.getWalletAccount(pickedId);
  if (account?.chain === "sui") {
    return tryParseSuiAddress(account.address);
  }
  return null;
}

/**
 * Replace a `contact_disambiguation` block with the result of prepare_send for the chosen match.
 */
export async function resolveAssistantContactDisambiguation(params: {
  accountId: string;
  chatId: string;
  messageId: string;
  disambiguationId: string;
  pickedMatchId: string;
}) {
  const messages = chatHistoryService.getMessages(params.accountId, params.chatId);
  const message = messages.find((m) => m.id === params.messageId);
  if (!message?.metadata) {
    throw new Error("Message not found or has no structured metadata.");
  }

  const blocks = parseAssistantMessageMetadata(message.metadata);
  const idx = blocks.findIndex(
    (b) => b.type === "contact_disambiguation" && b.disambiguationId === params.disambiguationId,
  );
  if (idx < 0) {
    throw new Error("Disambiguation card not found or already resolved.");
  }

  const block = blocks[idx];
  if (block.type !== "contact_disambiguation") {
    throw new Error("Invalid structured block.");
  }

  const allowed = new Set(block.matches.map((m) => m.id));
  if (!allowed.has(params.pickedMatchId)) {
    throw new Error("That choice is not part of this disambiguation.");
  }

  const address = resolvePickAddress(params.pickedMatchId);
  if (!address) {
    throw new Error("Could not resolve address for the selected entry.");
  }

  const prepBlocks = await executePackageAction({
    accountId: params.accountId,
    namespacedName: PREPARE_SEND_ACTION_NAME,
    input: {
      token: block.token,
      amount: block.amount,
      recipient: address,
    },
  });

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
