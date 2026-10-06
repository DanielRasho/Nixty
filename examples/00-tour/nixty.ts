// A tour of Nixty: a small shell-script project described in TypeScript.
// Nixty turns this file into flake.nix; every `nixty` command below regenerates it for you first.
import { Command, Definition, DevShell, Licenses, Nixpkgs, Package, Path, Source, System, nix } from "nixty-lib"

// The systems everything here works on. Nixty writes each output once per system.
const SYSTEMS = [System.x86_64Linux, System.aarch64Darwin]

// Where the tools come from: nixpkgs, Nix's 100,000+ packages, pinned to a release.
const NIX_PKGS = new Nixpkgs({ tag: "nixos-25.05" })

// A package: hello.sh from this folder, installed as the `hello` program.
// Try it: `nixty run hello Ana`, or `nixty build hello` (the result goes to ./result/bin).
const hello = new Package("hello", SYSTEMS, (system) => ({
    version: "1.0.0",
    src: new Source(Path.fetchInternalPath(".")),
    deps: {
        // Programs hello.sh calls. They're added to its PATH, so users don't have to install them.
        atRuntime: NIX_PKGS.getPackages(["figlet", "cowsay"], system),
    },
    // Nothing to compile, so the only step is copying the script. `out` is the install folder, and
    // the `nix` tag is how values go inside Nix strings.
    phases: (out) => ({
        install: nix`install -Dm755 hello.sh ${out}/bin/hello`,
    }),
    metadata: { description: "Says hello in big letters", license: Licenses.MIT, mainProgram: "hello" },
}))

// A dev shell: a terminal with these tools, at the same versions for everyone who opens it.
// Try it: `nixty develop dev`, then `hello`.
const dev = new DevShell({
    name: "dev",
    systems: SYSTEMS,
    // Your own package sits right next to nixpkgs' ones.
    packages: (system) => [hello.getDerivation(system), ...NIX_PKGS.getPackages(["shellcheck"], system)],
    env: { GREETING: "Hi" },
    onEnter: `echo "Welcome! Try: hello, or shellcheck hello.sh"`,
})

// The same shell in Spanish: `extends` copies `dev` and changes only what you write.
const devEs = new DevShell({ name: "dev-es", extends: dev, env: { GREETING: "Hola" } })

// A command, like an npm script: it runs with its tools without installing anything.
// Try it: `nixty command lint`.
const lint = new Command({
    name: "lint",
    systems: SYSTEMS,
    packages: (system) => NIX_PKGS.getPackages(["shellcheck"], system),
    command: "shellcheck hello.sh && echo 'hello.sh looks good'",
})

// The project: everything it offers. nixty reads the file's default export.
export default new Definition({
    description: "A tour of Nixty",
    nixpkgs: NIX_PKGS,
    packages: [hello],
    devShells: [dev, devEs],
    commands: [lint],
})
