import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/globalSetup.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false, // tests share one database — run serially
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
  resolve: {
    // Source uses NodeNext ".js" import specifiers; map them back to ".ts".
    extensionAlias: { ".js": [".ts", ".js"] },
  },
});
