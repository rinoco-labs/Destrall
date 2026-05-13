import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@packages": path.resolve(__dirname, "src/packages"),
    },
  },
  build: {
    rollupOptions: {
      external: ["node:sqlite", "node-llama-cpp"],
    },
  },
});
