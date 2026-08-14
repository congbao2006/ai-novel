import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@ai-novel/ai-engine": fileURLToPath(
        new URL("../../packages/ai-engine/src/index.ts", import.meta.url)
      ),
      "@ai-novel/config": fileURLToPath(
        new URL("../../packages/config/src/index.ts", import.meta.url)
      ),
      "@ai-novel/db": fileURLToPath(
        new URL("../../packages/db/src/index.ts", import.meta.url)
      ),
      "@ai-novel/domain": fileURLToPath(
        new URL("../../packages/domain/src/index.ts", import.meta.url)
      )
    }
  }
});
