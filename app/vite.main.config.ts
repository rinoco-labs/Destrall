import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRANDING_SRC = path.resolve(__dirname, "src/assets/branding");
const BRANDING_OUT = path.resolve(__dirname, ".vite/build/branding");

/** Keep platform icons beside the compiled main bundle so dev mode can load them reliably. */
function copyBrandingForMainProcess(): Plugin {
  const copy = () => {
    if (!fs.existsSync(BRANDING_SRC)) {
      return;
    }
    fs.mkdirSync(path.dirname(BRANDING_OUT), { recursive: true });
    fs.cpSync(BRANDING_SRC, BRANDING_OUT, { recursive: true });
  };

  return {
    name: "copy-branding-main",
    buildStart: copy,
    writeBundle: copy,
    configureServer() {
      copy();
    },
    handleHotUpdate({ file }) {
      if (file.startsWith(BRANDING_SRC)) {
        copy();
      }
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      "@packages": path.resolve(__dirname, "src/packages"),
    },
  },
  plugins: [copyBrandingForMainProcess()],
  build: {
    rollupOptions: {
      external: ["node:sqlite", "node-llama-cpp"],
    },
  },
});
