import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Let @ be the an alias to './test' folder
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./tests"),
    },
  },
  test: {
    // Just run the main file, it will be the entry point for all tests.
    // include: ["./test/main.test.ts"],
    // Display a detailed report of tests
    reporters: [["verbose"]],
    // globalSetup: ["./test/globalSetup.ts"],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  printConsoleTrace: true,
  silent: false,
});