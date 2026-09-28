#!/usr/bin/env node

// Entry point for the `nixty` binary. Command dispatch (generate flake.nix,
// passthrough to `nix`) lands here as it's implemented.
export function main(argv: string[] = process.argv.slice(2)): void {
  console.log("nixty: no commands implemented yet");
  console.log("Still working on it")
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
