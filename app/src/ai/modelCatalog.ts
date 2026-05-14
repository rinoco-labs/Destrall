/**
 * Central catalog for on-device GGUF models (node-llama-cpp).
 * UI and services must not hardcode Hugging Face URIs elsewhere.
 */

export type ModelQuantization = "Q4_K_M" | "Q4_0" | string;

export type ModelCatalogEntry = {
  id: string;
  name: string;
  description: string;
  /** Final filename on disk under the Destrall models directory */
  filename: string;
  /** URI understood by node-llama-cpp `resolveModelFile` (e.g. hf:org/repo:quant) */
  downloadUrl: string;
  sizeBytes?: number;
  quantization: ModelQuantization;
  contextLength: number;
  recommendedDeviceNotes: string;
  /** Same as `filename`; present for callers that expect an explicit local leaf name */
  localPath: string;
  /** Optional SHA-256 of full file; HF downloads use size verify when checksum absent */
  checksum?: string;
  repo: string;
  repoUrl: string;
  fallbackFileNames: string[];
  category: "lightweight" | "balanced" | "quality";
};

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: "qwen2.5-3b-instruct-q4-k-m",
    name: "Qwen2.5 3B Instruct (Q4_K_M)",
    description: "Strong instruction-following with moderate hardware requirements.",
    filename: "qwen2.5-3b-instruct-q4_k_m.gguf",
    downloadUrl: "hf:Qwen/Qwen2.5-3B-Instruct-GGUF:Q4_K_M",
    sizeBytes: 2_147_000_000,
    quantization: "Q4_K_M",
    contextLength: 32768,
    recommendedDeviceNotes: "Apple Silicon 16GB+ RAM recommended; runs on CPU.",
    localPath: "qwen2.5-3b-instruct-q4_k_m.gguf",
    repo: "Qwen/Qwen2.5-3B-Instruct-GGUF",
    repoUrl: "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF",
    fallbackFileNames: ["Qwen2.5-3B-Instruct-Q4_K_M.gguf"],
    category: "balanced",
  },
  {
    id: "gemma-4-e2b-it-q4-0",
    name: "Gemma 4 E2B IT (Q4_0)",
    description: "Higher quality responses at a larger footprint.",
    filename: "gemma-4-e2b-it-q4_0.gguf",
    downloadUrl: "hf:unsloth/gemma-4-E2B-it-GGUF:Q4_0",
    sizeBytes: 3_041_376_384,
    quantization: "Q4_0",
    contextLength: 8192,
    recommendedDeviceNotes: "Prefer 24GB+ unified memory or discrete GPU with ample VRAM.",
    localPath: "gemma-4-e2b-it-q4_0.gguf",
    repo: "unsloth/gemma-4-E2B-it-GGUF",
    repoUrl: "https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF",
    fallbackFileNames: ["gemma-4-e2b-it-Q4_0.gguf"],
    category: "quality",
  },
];

export const MODEL_CATALOG_BY_ID: Record<string, ModelCatalogEntry> = Object.fromEntries(
  MODEL_CATALOG.map((m) => [m.id, m]),
);
