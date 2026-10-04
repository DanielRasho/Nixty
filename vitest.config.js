import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Let @ be the an alias to './test' folder
  resolve: {
    // Exact matches, so "nixty-lib" doesn't also catch "nixty-lib/compiler". Keep in sync with
    // "paths" in tsconfig.json.
    alias: [
      { find: "@", replacement: path.resolve(import.meta.dirname, "./test") },
      { find: /^nixty-lib$/, replacement: path.resolve(import.meta.dirname, "./src/index.ts") },
      { find: /^nixty-lib\/compiler$/, replacement: path.resolve(import.meta.dirname, "./src/compiler.ts") },
    ],
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Display a detailed report of tests
    reporters: [["verbose"]],
    // globalSetup: ["./test/globalSetup.ts"],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  printConsoleTrace: true,
  silent: false,
});