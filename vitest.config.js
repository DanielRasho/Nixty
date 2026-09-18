import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Let @ be the an alias to './test' folder
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./test"),
    },
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