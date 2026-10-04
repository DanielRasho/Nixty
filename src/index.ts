// Public entry "nixty-lib": everything a user's nixty.ts describes its project with. Only re-exports.
// The compiler lives in "nixty-lib/compiler", so a user's file doesn't load it.

export { Command, type CommandDefinition } from "./compiler/api/command.js"
export { Definition, type DefinitionOptions } from "./compiler/api/definition.js"
export { DevShell, type DevShellDefinition } from "./compiler/api/devShell.js"
export { Flake, Nixpkgs, type NixpkgsOptions } from "./compiler/api/helpers.js"
export { Package } from "./compiler/api/package.js"
export {
    DefaultPhases,
    Derivation,
    DerivationKind,
    Expresion,
    NixString,
    Path,
    Source,
    nix,
    type DerivationDefinition,
    type DerivationDeps,
    type DerivationPhases,
    type GitLabOptions,
    type GitOptions,
    type GithubOptions,
    type Interpolable,
    type MercurialOptions,
    type NixArg,
    type SourceHutOptions,
    type TarballOptions,
} from "./compiler/api/primitives.js"
export { License, Licenses, System } from "./compiler/constants.js"
export { NixtyError } from "./compiler/errors.js"
