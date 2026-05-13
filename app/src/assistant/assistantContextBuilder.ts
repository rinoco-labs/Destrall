import { chainFacadeService } from "../main/services/chains/chainFacadeService";
import { walletService } from "../main/wallet/walletService";
import { actionRegistry } from "../packages/runtime/actionRegistry";
import { contactRepository } from "../main/persistence/repositories/contactRepository";
import { assistantToolDefinitionsForModel } from "./assistantFunctionSchemas";

function contactInScope(accountId: string, row: { accountId: string | null; chain: string }): boolean {
  if (row.chain !== "sui") return false;
  if (row.accountId != null && row.accountId !== accountId) return false;
  return true;
}

/**
 * Non-secret assistant context: balances, contacts summary, tool schemas, network.
 */
export async function buildAssistantContextDocument(accountId: string): Promise<string> {
  const base = await chainFacadeService.buildAssistantWalletContext(accountId);
  const lines: string[] = [base];

  const account = walletService.getWalletAccount(accountId);
  if (account) {
    const others = walletService
      .getStatus()
      .accounts.filter((a) => a.chain === "sui" && a.id !== accountId)
      .map((a) => `- ${a.name}: ${a.address}`)
      .slice(0, 12);
    if (others.length) {
      lines.push("Other Sui accounts in this wallet (for “my other wallet” sends):");
      lines.push(...others);
    }
  }

  const contacts = contactRepository
    .list()
    .filter((c) => contactInScope(accountId, c))
    .slice(0, 30)
    .map((c) => `- ${c.name} → ${c.address}`);
  if (contacts.length) {
    lines.push("Contacts (Sui, scoped to this account):");
    lines.push(...contacts);
  } else {
    lines.push("Contacts: none stored for this scope.");
  }

  lines.push("Security: the assistant cannot sign transactions or see your seed phrase or private keys.");
  lines.push("Available deterministic tools (names must match exactly):");
  for (const t of assistantToolDefinitionsForModel) {
    lines.push(`- ${t.name}: ${t.description}`);
  }

  const descriptors = actionRegistry.listForAssistant();
  if (descriptors.length) {
    lines.push("Registered package actions (prepare-only for transfers):");
    for (const d of descriptors) {
      lines.push(`- ${d.namespacedName}: ${d.description}`);
    }
  }

  lines.push(
    "Risk settings: treat every send as irreversible; verify the full recipient address before approving.",
  );

  return lines.filter(Boolean).join("\n");
}
