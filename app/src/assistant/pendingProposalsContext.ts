import type { AssistantMessageRow } from "../shared/assistantChat";
import type { AssistantMessageMetadataV1, AssistantStructuredResult } from "./assistantResultTypes";
import { isProposalStructuredResult } from "./assistantResultTypes";

function isMetadataV1(parsed: unknown): parsed is AssistantMessageMetadataV1 {
  if (!parsed || typeof parsed !== "object") return false;
  const o = parsed as Record<string, unknown>;
  return o.v === 1 && Array.isArray(o.structured);
}

/**
 * Summarizes outstanding proposal cards in the thread so the model knows execution is still pending.
 */
export function formatPendingProposalsForContext(
  messages: readonly Pick<AssistantMessageRow, "role" | "metadata">[],
): string | undefined {
  const lines: string[] = [];
  for (const m of messages) {
    if (m.role !== "assistant" || !m.metadata) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(m.metadata);
    } catch {
      continue;
    }
    if (!isMetadataV1(parsed)) continue;
    for (const block of parsed.structured as AssistantStructuredResult[]) {
      if (!isProposalStructuredResult(block)) continue;
      if (block.status !== "pending") continue;
      const title = block.card?.title?.trim() || block.type.replace(/_/g, " ");
      if (block.type === "swap_proposal") {
        lines.push(`Pending swap proposal (user must approve card): ${title}`);
      } else if (block.type === "send_proposal") {
        lines.push(`Pending send proposal (user must approve card): ${title}`);
      } else if (block.type === "navi_deposit_proposal") {
        lines.push(`Pending Navi deposit proposal (user must approve card): ${title}`);
      } else if (block.type === "navi_withdraw_proposal") {
        lines.push(`Pending Navi withdraw proposal (user must approve card): ${title}`);
      }
    }
  }
  if (lines.length === 0) return undefined;
  return lines.slice(-6).join("\n");
}
