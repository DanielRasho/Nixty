// Using nixpkgs' helpers: `writeShellScriptBin` turns a script into a program, and `lib` functions
// compute values while Nix evaluates the flake.
// Try it: `nixty develop utils`, then `moo` and `echo $PROJECT $TOOLS`.
import { Definition, Derivation, DevShell, Nixpkgs, System, nix } from "nixty-lib"

const SYSTEMS = [System.x86_64Linux]

const NIX_PKGS = new Nixpkgs({ tag: "nixos-25.05" })

const toUpper = NIX_PKGS.getLib("strings.toUpper")
const concatStringsSep = NIX_PKGS.getLib("strings.concatStringsSep")

// A program named `moo`. `${cowsay}` becomes cowsay's path in the Nix store, so `moo` works even
// where cowsay isn't installed.
const moo = (system: System) => {
    const [cowsay] = NIX_PKGS.getPackages(["cowsay"], system)
    const writeShellScriptBin = NIX_PKGS.getExpresion("writeShellScriptBin", system)
    return Derivation.fromExpresion(system, writeShellScriptBin("moo", nix`${cowsay}/bin/cowsay "moo"`))
}

const utils = new DevShell({
    name: "utils",
    systems: SYSTEMS,
    packages: (system) => [moo(system)],
    env: {
        PROJECT: nix`${toUpper("nixty")}`,
        TOOLS: nix`${concatStringsSep(", ", ["moo", "cowsay"])}`,
    },
})

export default new Definition({
    description: "Example 04: nixpkgs utilities",
    nixpkgs: NIX_PKGS,
    devShells: [utils],
})
