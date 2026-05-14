/**
 * Single on-device GGUF used by the assistant (node-llama-cpp).
 * User-facing UI must not reference filenames, Hugging Face repos, or vendor branding.
 */

export type InternalAiRuntime = "gguf";

/** Shape expected by node-llama-cpp download + disk layout */
export type InternalGgufModelConfig = {
  /** Stable logical id persisted in SQLite */
  id: string;
  /** Internal implementation tag — never shown in UI */
  runtime: InternalAiRuntime;
  filename: string;
  downloadUrl: string;
  sizeBytes?: number;
  contextLength: number;
  localPath: string;
  repo: string;
  fallbackFileNames: string[];
};

export const INTERNAL_AI_MODEL: InternalGgufModelConfig = {
  id: "assistant-model",
  runtime: "gguf",
  filename: "qwen2.5-3b-instruct-q4_k_m.gguf",
  downloadUrl: "hf:Qwen/Qwen2.5-3B-Instruct-GGUF:Q4_K_M",
  sizeBytes: 2_147_000_000,
  contextLength: 32768,
  localPath: "qwen2.5-3b-instruct-q4_k_m.gguf",
  repo: "Qwen/Qwen2.5-3B-Instruct-GGUF",
  fallbackFileNames: ["Qwen2.5-3B-Instruct-Q4_K_M.gguf"],
};
