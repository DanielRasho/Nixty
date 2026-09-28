import { flake, input, packageSet, nix, raw, systems, src } from "nixty-lib";

// =====================
//     INPUTS
// =====================
// Object keys in `flake({ inputs })` become the attribute names, so these
// consts don't need to carry a name themselves.

const nixpkgs = input("github:NixOS/nixpkgs/nixos-25.05");
const unstable = input("github:NixOS/nixpkgs/nixos-unstable");

const home = input("github:nix-community/home-manager", {
  follows: { nixpkgs }, // home-manager.inputs.nixpkgs.follows = "nixpkgs"
});

// A non-flake input is just a pinned source tree; used as `src` below.
const greeterSrc = input("github:DanielRasho/greeter", { flake: false });

// =====================
//     PACKAGE SETS
// =====================
// A package set is tied to the input it comes from, so every ref knows
// where to be resolved. Two nixpkgs pins side by side is the common case.

const pkgs = packageSet(nixpkgs, {
  config: { allowUnfree: true },
});
const upkgs = packageSet(unstable);

// =====================
//     PACKAGES
// =====================
// Builders are the nixpkgs ones, typed. Field names mirror mkDerivation 1:1
// so nixpkgs docs apply directly.

const hello = pkgs.stdenv.mkDerivation({
  pname: "hello",
  version: "1.0.0",
  src: src.self(), // ./.

  strictDeps: true,
  // Tools: run on the build machine, don't end up in the output.
  nativeBuildInputs: [upkgs.go, pkgs.makeWrapper], // go from unstable, rest from stable
  // Parts: linked into the output. Chosen per system when needed.
  buildInputs: (system) =>
    system === systems.aarch64Darwin ? [pkgs.openssl] : [pkgs.openssl, pkgs.systemd],

  buildPhase: "go build -o hello ./cmd/hello",
  installPhase: nix`
    mkdir -p $out/bin
    cp hello $out/bin/
  `,
  postFixup: nix`
    wrapProgram $out/bin/hello --prefix PATH : ${pkgs.lib.makeBinPath([pkgs.git])}
  `,

  doCheck: true,
  checkPhase: "go test ./...",

  meta: {
    description: "A package to say hello to anyone",
    homepage: "https://github.com/DanielRasho/Nixty",
    license: pkgs.lib.licenses.mit,
    mainProgram: "hello", // what `nix run .#hello` executes
  },
});

// Language builders take the same fields as mkDerivation plus their own.
// No `npm install` in a phase: builds have no network, deps come from the hash.
const web = pkgs.buildNpmPackage({
  pname: "hello-web",
  version: "1.0.0",
  src: src.self(),
  npmDepsHash: "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",

  buildPhase: "npm run build",
  installPhase: nix`
    mkdir -p $out/share/hello-web
    cp -r dist/* $out/share/hello-web/
  `,

  meta: {
    description: "Web frontend for hello",
    license: pkgs.lib.licenses.mit,
  },
});

// Building someone else's project from a pinned non-flake input.
const greeter = pkgs.stdenv.mkDerivation({
  pname: "greeter",
  version: "0.3.1",
  src: greeterSrc,
  nativeBuildInputs: [pkgs.cmake, pkgs.pkg_config],
  buildInputs: [pkgs.zlib],
  meta: { license: pkgs.lib.licenses.gpl3Plus, mainProgram: "greeter" },
});

// Customising an existing nixpkgs package instead of writing one from scratch.
const jqPatched = pkgs.jq.overrideAttrs({
  patches: [src.file("./patches/jq-colors.patch")],
});

// A package from another flake's outputs: inputs.home.packages.${system}.home-manager
const homeManager = home.packages["home-manager"];

// =====================
//     DEV SHELLS
// =====================

const dev = pkgs.mkShell({
  inputsFrom: [hello, web], // inherit both packages' build deps
  packages: [pkgs.gopls, pkgs.nodejs_22, pkgs.vite, jqPatched, homeManager],
  env: {
    GOFLAGS: "-mod=vendor",
  },
  shellHook: 'echo "dev shell for hello"',
});

const qa = pkgs.mkShell({
  packages: (system) =>
    system === systems.aarch64Darwin
      ? [pkgs.nodejs_22, pkgs.go]
      : [pkgs.nodejs_22, pkgs.go, pkgs.chromium], // no chromium on darwin
  shellHook: 'echo "QA shell"',
});

// =====================
//     FLAKE
// =====================

export default flake({
  description: "A definition for this project",

  inputs: { nixpkgs, unstable, home, greeterSrc },

  // Every output below is emitted once per system (native builds; not cross).
  systems: [systems.x86_64Linux, systems.aarch64Linux, systems.aarch64Darwin],

  // Keys become output names. `default` is what `nix build` / `nix develop`
  // use with no argument.
  packages: { hello, web, greeter, default: hello },
  devShells: { dev, qa, default: dev },

  // `nix run .#<name>`
  apps: {
    hello: { program: hello }, // uses meta.mainProgram
    greet: { program: nix`${greeter}/bin/greeter --loud` },
  },

  // `nix flake check` builds all of these.
  checks: { hello, web },

  // `nix fmt`
  formatter: pkgs.nixfmt_rfc_style,

  // Escape hatch for anything the DSL doesn't model. Emitted verbatim.
  extra: {
    lib: raw('{ greet = name: "hello " + name; }'),
  },
});
