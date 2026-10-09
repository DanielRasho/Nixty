// A definition using every kind of output, compiled to compile01.nix by test/compiler/compile.test.ts.
import { Command, DefaultPhases, Definition, DevShell, Flake, Licenses, Nixpkgs, Package, Path,
    Source, System, nix } from "nixty-lib"

const SYSTEMS = [System.x86_64Linux, System.aarch64Linux]

const NIX_PKGS = new Nixpkgs({ tag: "nixos-25.05" })
const TOOLS = new Flake(Path.fetchFromGithub({ owner: "me", repo: "tools", tag: "v1.0" }))
// Declared but never used: left out of the flake.
const UNUSED = new Flake(Path.fetchFromGithub({ owner: "me", repo: "unused", tag: "v1.0" }))

const defaultConfig = (system: System) =>
    NIX_PKGS.getExpresion("writeText", system)(
        "weather-config",
        JSON.stringify({ city: "Mexico City", units: "metric" }),
    )

const WeatherCLI = new Package({
    name: "WeatherCLI",
    systems: SYSTEMS,
    definition: (system) => {
        const [nodejs, go, vitest] = NIX_PKGS.getPackages(["nodejs_22", "go", "vitest"], system)
        return {
            version: "1.0.0",
            src: new Source(Path.fetchInternalPath(".")),
            deps: {
                atBuild: [nodejs],
                atRuntime: [nodejs],
                atTest: [vitest],
                linkedLibs: system === System.aarch64Linux ? [go] : [],
                linkedAndExportedLibs: [go],
            },
            phases: (out) => ({
                configure: DefaultPhases.CONFIGURE,
                build: nix`npm run build -- --config ${defaultConfig(system)}`,
                test: DefaultPhases.TEST,
                install: nix`mkdir -p ${out}/bin\ncp dist/weather ${out}/bin/`,
            }),
            metadata: {
                description: "Tells the weather of a city",
                license: Licenses.MIT,
                mainProgram: "weather",
            },
        }
    },
})

const QA = new DevShell({
    name: "QA",
    systems: SYSTEMS,
    packages: (system) => [
        ...NIX_PKGS.getPackages(["nodejs_22", "go"], system),
        ...TOOLS.getPackages(["cli"], system),
        WeatherCLI.getDerivation(system),
    ],
    env: { HELLO: "THERE WE GO" },
    onEnter: `echo "QA shell"`,
})

const PROD = new DevShell({
    extends: QA,
    name: "PROD",
    packages: (system) => NIX_PKGS.getPackages(["gopls"], system),
})

const test = new Command({
    name: "test",
    systems: [System.x86_64Linux],
    packages: (system) => NIX_PKGS.getPackages(["nodejs_22"], system),
    env: { CI: "1" },
    command: "npm test",
})

void UNUSED

export default new Definition({
    description: "A definition for this project",
    nixpkgs: NIX_PKGS,
    packages: [WeatherCLI],
    devShells: [QA, PROD],
    commands: [test],
})
