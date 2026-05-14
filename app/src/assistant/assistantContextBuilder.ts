import { buildCompactAssistantContext, type CompactContextOptions } from "./contextBuilder";

export type AssistantContextBuildOptions = CompactContextOptions;

/** @deprecated Prefer `buildCompactAssistantContext` from `./contextBuilder`. */
export async function buildAssistantContextDocument(
  accountId: string,
  options?: AssistantContextBuildOptions,
): Promise<string> {
  return buildCompactAssistantContext(accountId, options);
}
