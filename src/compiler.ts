// Public entry "nixty-lib/compiler": turns a definition into flake.nix. Used by the CLI and by scripts,
// never needed inside a user's nixty.ts. Only re-exports.

export { compile, generate, type GenerateOptions } from "./compiler/compiler.js"
