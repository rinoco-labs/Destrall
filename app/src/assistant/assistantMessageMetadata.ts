import type { AssistantMessageMetadataV1, AssistantStructuredResult } from "./assistantResultTypes";

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
    return b;
  });
  return serializeAssistantMessageMetadata(next);
}
