// weathercli, written for what the package IS rather than how Nix builds it.
import { nixpkgs, program, devShell, flake, file, src, systems, licenses } from "nixty-lib";

// Registers the `nixpkgs` input and gives back its package set in one step.
const pkgs = nixpkgs("nixos-unstable");

// A file shipped inside the package. The handle is reused below to point the
// program at it, so the path is written once.
const defaultConfig = file.json("share/weathercli/config.json", {
  city: "Mexico City",
  units: "metric",
  format: "compact",
});

const weathercli = program({
  name: "weathercli",
  version: "1.0.0",
  description: "Reporte del clima en la terminal, configurable vía un archivo JSON",
  license: licenses.mit,

  // Everything the package contains, by path inside it.
  files: [
    file.executable("bin/weathercli", src.file("./weathercli.sh")),
    defaultConfig,
  ],

  // Programs weathercli calls. They're put on its PATH so users don't need
  // to install them separately.
  runtimeDeps: [pkgs.curl, pkgs.jq],

  // Environment the program starts with. Users can still override these.
  env: {
    WEATHERCLI_CONFIG: defaultConfig, // resolves to its installed path
  },
});

const dev = devShell({
  packages: [weathercli],
  onEnter: `echo "weathercli dev shell — corre 'weathercli' para probar"`,
});

export default flake({
  description: "weathercli — reporte del clima en la terminal",
  systems: [
    systems.x86_64Linux,
    systems.aarch64Linux,
    systems.x86_64Darwin,
    systems.aarch64Darwin,
  ],
  packages: { default: weathercli },
  devShells: { default: dev },
});
