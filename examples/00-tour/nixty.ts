// A tour of Nixty: a shell script, packaged with the tools it needs.
import { Command, Definition, DevShell, Nixpkgs, Package, Path, Source, System, nix } from "nixty-lib"

const SYSTEMS = [System.x86_64Linux, System.aarch64Darwin]

// Where things come from: nixpkgs, and this folder.
const NIX_PKGS = new Nixpkgs({ tag: "nixos-25.05" })
const SRC = new Source(Path.fetchInternalPath("."))

// A package: hello.sh, installed as `hello`. Try: `nixty run hello Ana`
const hello = new Package({
    name: "hello",
    systems: SYSTEMS,
    definition: (system) => ({
        version: "1.0.0",
        src: SRC,
        deps: { atRuntime: NIX_PKGS.getPackages(["figlet", "cowsay"], system) },
        phases: (out) => ({ install: nix`install -Dm755 hello.sh ${out}/bin/hello` }),
    }),
})

// A dev shell: a terminal with these tools. Try: `nixty develop dev`
const dev = new DevShell({
    name: "dev",
    systems: SYSTEMS,
    packages: (system) => [hello.getDerivation(system), ...NIX_PKGS.getPackages(["shellcheck"], system)],
    onEnter: `echo "Try: hello Ana"`,
})

// A command: a script that brings its own tools. Try: `nixty command lint`
const lint = new Command({
    name: "lint",
    systems: SYSTEMS,
    packages: (system) => NIX_PKGS.getPackages(["shellcheck"], system),
    command: "shellcheck hello.sh && echo 'hello.sh looks good'",
})

export default new Definition({
    description: "A tour of Nixty",
    nixpkgs: NIX_PKGS,
    packages: [hello],
    devShells: [dev],
    commands: [lint],
})
