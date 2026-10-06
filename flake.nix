{
  description = "Generate Nix Flakes using Typescript";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      # nixpkgs-unstable no longer supports x86_64-darwin (Intel Macs).
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" ];

      forAllSystems = f: nixpkgs.lib.genAttrs supportedSystems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      # `nix run github:DanielRasho/Nixty -- generate`, or `nix profile add github:DanielRasho/Nixty`.
      packages = forAllSystems (pkgs: rec {
        nixty = pkgs.callPackage ./nix/package.nix { };
        default = nixty;
      });

      # For NixOS and home-manager configurations: adds `pkgs.nixty`.
      overlays.default = final: prev: {
        nixty = final.callPackage ./nix/package.nix { };
      };

      # For working on nixty itself.
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [ pkgs.nodejs_24 pkgs.pnpm_11 ];
        };
      });
    };
}
