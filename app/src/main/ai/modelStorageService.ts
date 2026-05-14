import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { INTERNAL_AI_MODEL, type InternalGgufModelConfig } from "../../ai/internalModelConfig";

export class ModelStorageService {
  getModelDirectory(): string {
    const dir = path.join(app.getPath("home"), ".destrall", "models");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  getModelFilePath(entry: InternalGgufModelConfig): string {
    return path.join(this.getModelDirectory(), entry.filename);
  }

  modelFileExists(entry: InternalGgufModelConfig): boolean {
    const primary = this.getModelFilePath(entry);
    if (fs.existsSync(primary) && fs.statSync(primary).isFile()) return true;
    for (const name of entry.fallbackFileNames) {
      const p = path.join(this.getModelDirectory(), name);
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return true;
    }
    return false;
  }

  /** Resolve an existing GGUF path for the built-in assistant weights (includes legacy filenames). */
  resolveExistingPath(): string | null {
    const entry = INTERNAL_AI_MODEL;
    const candidates = [entry.filename, ...entry.fallbackFileNames];
    for (const name of candidates) {
      const p = path.join(this.getModelDirectory(), name);
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    }
    return null;
  }

  validateModelFile(modelPath: string, expectedSizeBytes?: number): { ok: true } | { ok: false; error: string } {
    if (!fs.existsSync(modelPath)) {
      return { ok: false, error: `Model file not found: ${modelPath}` };
    }
    const stat = fs.statSync(modelPath);
    if (!stat.isFile()) {
      return { ok: false, error: `Not a file: ${modelPath}` };
    }
    if (stat.size <= 0) {
      return { ok: false, error: `Model file is empty: ${modelPath}` };
    }
    if (!modelPath.toLowerCase().endsWith(".gguf")) {
      return { ok: false, error: `Invalid model file extension (expected .gguf): ${modelPath}` };
    }
    if (expectedSizeBytes != null && expectedSizeBytes > 0) {
      const tolerance = Math.max(512 * 1024, Math.floor(expectedSizeBytes * 0.02));
      if (stat.size < expectedSizeBytes - tolerance) {
        return {
          ok: false,
          error: `Model file size mismatch (expected ~${expectedSizeBytes} bytes, got ${stat.size})`,
        };
      }
    }
    return { ok: true };
  }

  deleteModelFiles(entry: InternalGgufModelConfig): void {
    const paths = new Set<string>();
    paths.add(this.getModelFilePath(entry));
    for (const name of entry.fallbackFileNames) {
      paths.add(path.join(this.getModelDirectory(), name));
    }
    /** Remove obsolete multi-model artifacts safely */
    for (const name of ["gemma-4-e2b-it-q4_0.gguf", "gemma-4-e2b-it-Q4_0.gguf"]) {
      paths.add(path.join(this.getModelDirectory(), name));
    }
    for (const p of paths) {
      try {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          fs.unlinkSync(p);
        }
      } catch {
        /* ignore per-file delete errors */
      }
    }
  }
}

export const modelStorageService = new ModelStorageService();
