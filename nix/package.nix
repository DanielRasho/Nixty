# The `nixty` CLI (and the nixty-lib it bundles), built from this repository with pnpm.
{
  lib,
  stdenv,
  nodejs-slim_24,
  pnpm_11,
  fetchPnpmDeps,
  pnpmConfigHook,
  makeWrapper,
  versionCheckHook,
}:

let
  # The CLI runs the user's nixty.ts with Node's type stripping, which needs Node >= 22.18. The slim
  # build leaves out npm and the headers, which nixty never uses.
  nodejs = nodejs-slim_24;
  pnpm = pnpm_11;
in
stdenv.mkDerivation (finalAttrs: {
  pname = "nixty";
  # One version for npm and Nix: the one in package.json.
  version = (lib.importJSON ../package.json).version;

  # Only what the build reads, so editing docs, tests or examples doesn't rebuild it.
  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../package.json
      ../pnpm-lock.yaml
      ../tsconfig.json
      ../tsconfig.build.json
      ../src
    ];
  };

  # Every dependency in pnpm-lock.yaml, for all platforms (TypeScript 7's native compiler comes as one
  # package per platform), so the hash is the same on every system. Update it when the lockfile
  # changes: set it to "", build, and copy the hash Nix reports.
  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs) pname version src;
    inherit pnpm;
    fetcherVersion = 4;
    hash = "sha256-hOOA8wB/R7ojczCy84pYIIlpQFYFm7vRvJh0QO7vcFc=";
  };

  nativeBuildInputs = [
    nodejs
    pnpm
    pnpmConfigHook
    makeWrapper
  ];

  buildPhase = ''
    runHook preBuild
    pnpm build
    runHook postBuild
  '';

  # The same files as the npm package, with only the runtime dependencies (commander, typescript).
  # The CLI runs the bundled tsc itself, so it stays in node_modules.
  installPhase = ''
    runHook preInstall

    pnpm prune --prod --ignore-scripts

    dest=$out/lib/node_modules/nixty-lib
    mkdir -p $dest
    cp -r package.json dist node_modules $dest/

    makeWrapper ${lib.getExe nodejs} $out/bin/nixty --add-flags $dest/dist/cli.js

    runHook postInstall
  '';

  doInstallCheck = true;
  nativeInstallCheckInputs = [ versionCheckHook ];

  meta = {
    description = "Generate Nix flakes from TypeScript";
    homepage = "https://github.com/DanielRasho/Nixty";
    license = lib.licenses.isc;
    mainProgram = "nixty";
    platforms = [
      "x86_64-linux"
      "aarch64-linux"
      "aarch64-darwin"
    ];
  };
})
