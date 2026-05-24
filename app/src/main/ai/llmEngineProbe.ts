import { app } from "electron";
import { INTERNAL_AI_MODEL } from "../../ai/internalModelConfig";
import { modelStorageService } from "./modelStorageService";

/** Shown in Settings / Assistant when the native LLM runtime cannot load in a packaged build. */
export const LOCAL_AI_ENGINE_UNAVAILABLE_MESSAGE =
  "The local AI engine failed to load. Please reinstall Destrall or download the latest version.";

export type LlmEngineProbeResult = {
  ok: boolean;
  errorMessage: string | null;
};

let probeResult: LlmEngineProbeResult | null = null;

function sanitizeModelPath(modelPath: string | null): string {
  if (!modelPath) return "(none)";
  const base = modelPath.split(/[/\\]/).slice(-2).join("/");
  return `…/${base}`;
}

/**
 * Verifies `node-llama-cpp` can be resolved at runtime (main process only).
 * Safe to call multiple times; result is cached for the process lifetime.
 */
export async function probeLlmEngine(): Promise<LlmEngineProbeResult> {
  if (probeResult) {
    return probeResult;
  }

  const modelPath = sanitizeModelPath(modelStorageService.resolveExistingPath());
  console.info(
    `[llm] startup probe packaged=${app.isPackaged} model=${modelPath} target=${INTERNAL_AI_MODEL.id}`,
  );

  try {
    await import("node-llama-cpp");
    console.info("[llm] node-llama-cpp import succeeded");
    probeResult = { ok: true, errorMessage: null };
    return probeResult;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[llm] node-llama-cpp import failed:", detail);
    probeResult = {
      ok: false,
      errorMessage: LOCAL_AI_ENGINE_UNAVAILABLE_MESSAGE,
    };
    return probeResult;
  }
}

export function getLlmEngineProbeResult(): LlmEngineProbeResult | null {
  return probeResult;
}

export function isLlmEngineAvailable(): boolean {
  return probeResult?.ok === true;
}
