import { definition, fetcher, path, nixpkgs, flake, expresion, nix } from "nixty-lib"
import { pkg, devShell, licenses, systems, type System } from "nixty-lib/derivation"

const SYSTEMS = [systems.x86_64Linux, systems.aarch64Linux];

// =====================
//     FETCHERS
// =====================
// A fetcher only says HOW to obtain a source tree. It decides nothing about
// what is inside it.

const a1 = fetcher.fromPath({ path: "/opt/shared" })
const a2 = fetcher.fromGit({ url: "ssh://git@github.com/org/private.git", ref: "main", submodules: true })
const a3 = fetcher.fromMercurial({ url: "hg+https://example.org/repo" })
const a4 = fetcher.fromTarball({ url: "https://example.com/release-1.2.tar.gz", narHash: "sha256-AAAA…" })
const a5 = fetcher.fromGithub({ owner: "NixOS", repo: "nixpkgs", ref: "nixos-25.05" })
const a6 = fetcher.fromGitlab({ owner: "veloren", repo: "veloren" })
const a7 = fetcher.fromSourceHut({ owner: "~misterio", repo: "nix-colors" })

// =====================
//     EXPRESIONS
// =====================
// An expresion is a proxy standing for a Nix expression: attributes and calls
// on it are recorded, not evaluated.
const UTILITY = expresion.fromFile("./hello_world")

// =====================
//     ABSTRACTIONS
// =====================
// nixpkgs() and flake() wrap a fetcher and expose the structure each is known
// to have, so the attribute paths don't have to be spelled out by hand.

const NIX_PKGS = nixpkgs("github.com/nixpkgs", "34b0fd9vass1")
const OTHER_FLAKE = flake(a1)

const DefaultConfig = (system: System) =>
    NIX_PKGS.pkg(system, "writeText")(
        "weather-config",
        JSON.stringify({
            city: "Mexico City",
            units: "metric",
            format: "compact"
        })
    )

const WeatherCLI = pkg({
    name: "WeatherCLI",
    systems: SYSTEMS,
    definition: (system: System) => {
        let registry = NIX_PKGS.pkgsFor(system)
        return {
            version: "1.0.0",
            src: path("./"),
            deps: {
                atBuild:    [registry.nodejs_22],
                atRuntime:  [registry.nodejs_22],
                atTest:     [registry.nodejs_22],
                linkedLibs: system === systems.aarch64Linux
                    ? [registry.go]
                    : [UTILITY.helloWorld],
                linkedAndExportedLibs: [registry.go, registry.vitest],
            },
            phases: (out: string) => ({
                build: nix`npm ${out}/bin build && install ${DefaultConfig(system)}`,
                install: "npm install"
            }),
            meta: {
                description: "Says hello on the terminal",
                license: licenses.mit,
                mainProgram: "hello"
            }
        }
    }
})

const qaShell = devShell({
    name: "QA",
    systems: SYSTEMS,
    packages: (system: System) => 
        [
            ...NIX_PKGS.pkgs(system, "nodejs_22", "go", "vite"),
            ...WeatherCLI.dependencies()
        ],
    env: {
        HELLO: "THERE WE GO",
    },
    onEnter: `echo "QA shell"`,
});

const prodShell = devShell({
    extends: qaShell,
    name: "PROD",
    packages: (system: System) => NIX_PKGS.pkgs(system, "gopls"),
})

// =================
// 
// =================

const testCmd = devShell({
    name: "test",
    systems: SYSTEMS,
    packages: (system: System) => prodShell.packages(),
    env: { HELLO: "THERE WE GO",},
    cmd: `echo "QA shell"`,
});

export default definition({
    description: "A definition for this project",
    packages:  [WeatherCLI],
    devShells: [prodShell, qaShell],
    commands: [testCmd]
})
