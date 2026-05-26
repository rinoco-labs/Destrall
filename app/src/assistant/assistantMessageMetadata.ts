import type {
  AssistantMessageMetadataV1,
  AssistantStructuredResult,
  SwapProposalResult,
  TriggerListResult,
} from "./assistantResultTypes";

export function parseAssistantMessageMetadata(raw: string | null | undefined): AssistantStructuredResult[] {
  if (raw == null || raw === "") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return [];
    const o = parsed as Partial<AssistantMessageMetadataV1>;
    if (o.v !== 1 || !Array.isArray(o.structured)) return [];
    return o.structured as AssistantStructuredResult[];
  } catch {
    console.warn("[assistant] invalid message metadata JSON");
    return [];
  }
}

export function serializeAssistantMessageMetadata(structured: AssistantStructuredResult[]): string {
  const env: AssistantMessageMetadataV1 = { v: 1, structured };
  return JSON.stringify(env);
}

/** Merge fields into a proposal block (matched by `proposalId`) and re-serialize metadata. */
export function patchStructuredProposal(
  raw: string | null | undefined,
  proposalId: string,
  patch: Record<string, unknown>,
): string {
  const blocks = parseAssistantMessageMetadata(raw);
  const next = blocks.map((b) => {
    if ("proposalId" in b && b.proposalId === proposalId) {
      return { ...b, ...patch } as AssistantStructuredResult;
    }
    if (b.type === "composite_swap_then_deposit") {
      if (b.proposalId === proposalId) {
        return { ...b, ...patch } as AssistantStructuredResult;
      }
      if (b.swapProposal.proposalId === proposalId) {
        return {
          ...b,
          swapProposal: { ...b.swapProposal, ...patch } as SwapProposalResult,
        } as AssistantStructuredResult;
      }
    }
    return b;
  });
  return serializeAssistantMessageMetadata(next);
}

/** Replace trigger rows in every `trigger_list` block (e.g. after pause/delete in chat UI). */
export function patchTriggerListInMetadata(
  raw: string | null | undefined,
  triggers: TriggerListResult["triggers"],
): string {
  const blocks = parseAssistantMessageMetadata(raw);
  const next = blocks.map((b) =>
    b.type === "trigger_list" ? ({ ...b, triggers } satisfies TriggerListResult) : b,
  );
  return serializeAssistantMessageMetadata(next);
}
