import { definition, fetcher, path, nixpkgs, flake, expresion, nix, store, Path } from "nixty-lib"
import { pkg, devShell, licenses, systems, type System } from "nixty-lib/derivation"

const SYSTEMS = [systems.x86_64Linux, systems.aarch64Linux, windows32];

// =====================
//     FETCHERS
// =====================
// A fetcher only says HOW to obtain a source tree. It decides nothing about
// what is inside it.

const path1 = store.fetchFromGithub({ locked: true, owner: "NixOS", repo: "nixpkgs", ref: "nixos-25.05"})
const path2 = store.fetchFromSubPath({ locked: true, subpath: "./other_folder"})
const path3 = store.fetchFromURL({ locked: false, subpath: "discord.com/downloads/1.3"})

// =====================
//     EXPRESIONS
// =====================
const expresion1 = new Expresion(path2.sub("./uwu.nix"))
d.name

// =====================
//     DERIVATIONS
// =====================
const d = new Expresion(path2)

// =====================
//     SOURCES
// =====================
const source_code = Source(path3)

// ==========================
//     NIXPKGS FROM SCRATCH
// ==========================
const nixpkgs = new Expresion(path1)
// Derivation.outputPath() -> Path
const go = Derivation.FromExpresion(nixpkgs.legacyPackages.x86_65Linux.go)

// =====================
//     ABSTRACTIONS
// =====================
// nixpkgs() and flake() wrap a fetcher and expose the structure each is known
// to have, so the attribute paths don't have to be spelled out by hand.
const REGISTRY = nixpkgs("github.com/nixpkgs", "34b0fd9vass1")
// pkgs, pkgs -> derivations
// lib -> expresion
// expresion(route) -> 
const OTHER_FLAKE = flake(path2)

const DefaultConfig = (system: System) =>
    REGISTRY.pkg(system, "writeText")(
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

        const [nodejs, go, vitest] = REGISTRY.pkgs(system, "nodejs_22", "go", "vitest")

        return {
            version: "1.0.0",
            src: source_code,
            dependencies: {
                atBuild:    [nodejs], // nativeBuildInputs
                atRuntime:  [nodejs], // wrapProgram
                atTest:     [nodejs], // NativeCheckInputs/checkInputs
                linkedLibs: system === systems.aarch64Linux // buildInputs
                    ? [go]
                    : [UTILITY.streamlit],
                linkedAndExportedLibs: [go, vitest], // propagatedBuildInputs
            },
            phases: (out: Path) => ({
                build: nix`npm ${out}/bin build && install ${DefaultConfig(system)}`,
                install: "npm install"
            }),
            metadata: {
                description: "Tells the weather of city",
                license: licenses.mit,
                mainProgram: "weatherCLI"
            }
        }
    }
})

const qaShell = devShell({
    name: "QA",
    systems: SYSTEMS,
    packages: (system: System) => 
        [
            ...REGISTRY.pkgs(system, "nodejs_22", "go", "vite"),
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
    packages: (system: System) => REGISTRY.pkgs(system, "gopls"),
})

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
