// weathercli: a shell script packaged with its default config, compiled to weathercli.nix by
// test/compiler/compile.test.ts. Unlike compile01, it skips phases and adds its own postFixup.
import { Definition, DevShell, Licenses, Nixpkgs, Package, Path, Source, System, nix } from "nixty-lib"

const SYSTEMS = [System.x86_64Linux, System.aarch64Linux, System.x86_64Darwin, System.aarch64Darwin]

const NIX_PKGS = new Nixpkgs({ tag: "nixos-unstable" })

// Where the config is installed inside the package, written once for the install and the wrapper.
const CONFIG = "share/weathercli/config.json"

const defaultConfig = (system: System) =>
    NIX_PKGS.getExpresion("writeText", system)(
        "weathercli-config.json",
        JSON.stringify({ city: "Mexico City", units: "metric", format: "compact" }),
    )

const weathercli = new Package("weathercli", SYSTEMS, (system) => ({
    version: "1.0.0",
    src: new Source(Path.fetchInternalPath(".")),
    deps: {
        // Programs weathercli calls. They're put on its PATH so users don't need to install them.
        atRuntime: NIX_PKGS.getPackages(["curl", "jq"], system),
    },
    // No configure or build phase: there is nothing to compile.
    phases: (out) => ({
        install: nix`install -Dm755 weathercli.sh ${out}/bin/weathercli\ninstall -Dm644 ${defaultConfig(system)} ${out}/${CONFIG}`,
        // The config the program starts with. Users can still override it.
        postFixup: nix`wrapProgram ${out}/bin/weathercli --set-default WEATHERCLI_CONFIG ${out}/${CONFIG}`,
    }),
    metadata: {
        description: "Reporte del clima en la terminal, configurable vía un archivo JSON",
        license: Licenses.MIT,
        mainProgram: "weathercli",
    },
}))

const dev = new DevShell({
    name: "dev",
    systems: SYSTEMS,
    packages: (system) => [weathercli.getDerivation(system)],
    onEnter: `echo "weathercli dev shell — corre 'weathercli' para probar"`,
})

export default new Definition({
    description: "weathercli — reporte del clima en la terminal",
    nixpkgs: NIX_PKGS,
    packages: [weathercli],
    devShells: [dev],
})
