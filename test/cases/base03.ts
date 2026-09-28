import { flake, input, pkg, devShell, systems, licenses, src } from "nixty-lib";

const nixpkgs = input("github:NixOS/nixpkgs/nixos-25.05");
const home    = input("github:nix-community/home-manager", { follows: { nixpkgs } });

const SYSTEMS = [systems.x86_64Linux, systems.aarch64Linux];

const hello = pkg({
  pname: "hello",
  version: "1.0.0",
  systems: SYSTEMS,
  src: src.self(),
  nativeBuildInputs: (pkgs) => [pkgs.nodejs_22],
  buildInputs: (pkgs, system) =>
    system === systems.aarch64Linux ? [pkgs.go] : [pkgs.go_1_22],
  phases: {
    build:   "npm run build",
    install: "mkdir -p $out/bin && cp -r dist/* $out/bin",
  },
  meta: { description: "Says hello", license: licenses.mit, mainProgram: "hello" },
});

const qa = devShell({
  systems: SYSTEMS,
  packages: (pkgs) => [pkgs.nodejs_22, pkgs.go, pkgs.vite],
  inputsFrom: [hello],
  shellHook: `echo "QA shell"`,
});

export default flake({
  description: "A definition for this project",
  inputs:    { nixpkgs, home },
  packages:  { hello, default: hello },
  devShells: { qa, default: qa },
});