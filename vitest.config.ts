import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    include: [
      "client/src/**/*.test.{ts,tsx}",
      "server/**/*.test.ts",
    ],
    // Cada arquivo escolhe o ambiente correto:
    // - server/* roda em Node puro (sem CORS, fetch nativo)
    // - client/* roda em happy-dom (DOM + IndexedDB via fake-indexeddb)
    environment: "node",
    environmentMatchGlobs: [
      ["client/**/*.test.{ts,tsx}", "happy-dom"],
    ],
  },
});
