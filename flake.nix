{

  description = "Generate Nix Flakes using Typescript";

  inputs = {
    default-pkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
  };

  outputs = { self, default-pkgs }: let

      # SUPPORTED SYSTEMS
      supportedSystems = [ "x86_64-linux" "x86_64-darwin" "aarch64-linux" "aarch64-darwin" ];
      
      forAllSystems = default-pkgs.lib.genAttrs supportedSystems;

      nixpkgsFor = system : pkgs : import pkgs {
        inherit system;
        config.allowUnfree = true;
      };
    
  in
  {
    devShells = forAllSystems ( system: 
      let 
        defaultPkgs = nixpkgsFor system default-pkgs ;
      in 
      {
        default = defaultPkgs.mkShell {
          packages = with defaultPkgs; [
            nodejs 
            pnpm 
          ];
        };
      }
    ); 
  };
}