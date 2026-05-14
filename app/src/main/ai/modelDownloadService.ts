import type { InternalGgufModelConfig } from "../../ai/internalModelConfig";
import { modelStorageService } from "./modelStorageService";

export type DownloadProgressHandler = (fraction: number) => void;

export class ModelDownloadService {
  async downloadModel(
    entry: InternalGgufModelConfig,
    options?: {
      onProgress?: DownloadProgressHandler;
      signal?: AbortSignal;
    },
  ): Promise<string> {
    const { resolveModelFile } = await import("node-llama-cpp");
    const directory = modelStorageService.getModelDirectory();
    const modelPath = await resolveModelFile(entry.downloadUrl, {
      directory,
      fileName: entry.filename,
      verify: entry.sizeBytes != null,
      cli: false,
      signal: options?.signal,
      onProgress: ({ totalSize, downloadedSize }) => {
        if (totalSize > 0) {
          options?.onProgress?.(Math.min(1, downloadedSize / totalSize));
        }
      },
    });
    const validated = modelStorageService.validateModelFile(modelPath, entry.sizeBytes);
    if (validated.ok === false) {
      throw new Error(validated.error);
    }
    return modelPath;
  }
}

export const modelDownloadService = new ModelDownloadService();
