import { Command, DefaultPhases, Definition, DevShell, Nixpkgs, Package, Path, Source, System } from "nixty-lib"

// The machines this project works on.
const SYSTEMS = [System.x86_64Linux, System.aarch64Linux, System.x86_64Darwin, System.aarch64Darwin]

// Where things come from: nixpkgs, and the code to build.
// For your own code, use: new Source(Path.fetchInternalPath("."))
const NIX_PKGS = new Nixpkgs({ tag: "nixos-26.05" })
const SRC = new Source(Path.fetchFromTarball({ url: "https://ftp.gnu.org/gnu/hello/hello-2.12.2.tar.gz" }))

// A package: GNU Hello, built with ./configure and make. Try: `nixty run hello`
const hello = new Package("hello", SYSTEMS, () => ({
    version: "2.12.2",
    src: SRC,
    deps: {},
    phases: () => ({
        configure: DefaultPhases.CONFIGURE,
        build: DefaultPhases.BUILD,
        install: DefaultPhases.INSTALL,
    }),
}))

// A dev shell: a terminal with these tools. Try: `nixty develop dev`
const dev = new DevShell({
    name: "dev",
    systems: SYSTEMS,
    packages: (system) => [hello.getDerivation(system), ...NIX_PKGS.getPackages(["jq"], system)],
    onEnter: `echo "Try: hello"`,
})

// A command: a script that brings its own tools. Try: `nixty command greet`
const greet = new Command({
    name: "greet",
    systems: SYSTEMS,
    packages: (system) => [hello.getDerivation(system), ...NIX_PKGS.getPackages(["cowsay"], system)],
    command: "hello | cowsay",
})

export default new Definition({
    description: "My Nixty project",
    nixpkgs: NIX_PKGS,
    packages: [hello],
    devShells: [dev],
    commands: [greet],
})