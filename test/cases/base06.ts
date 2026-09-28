import { project, input, nixpkgs, program, shell, file, systems, licenses } from "nixty-lib";

// =====================
//     DEPENDENCIES
// =====================

const pkgs = nixpkgs("nixos-25.05");
const shared = input("shared", "path:./shared");

const helloSrc = {
  [systems.x86_64Linux]: input("hello-x86", "github:DanielRasho/Nixty-x86", { flake: false }),
  [systems.aarch64Linux]: input("hello-arm", "github:DanielRasho/Nixty-aarch64", { flake: false }),
};

// =====================
//     PROJECT
// =====================
// One method per output category. Each lambda runs once per system and
// receives what the previous steps produced for that system, so `packages.hello`
// in `.shells()` is this system's hello, fully typed.

export default project({
  description: "A definition for this project",
  systems: [systems.x86_64Linux, systems.aarch64Linux],
})
  .packages((system) => {
    const isArm = system === systems.aarch64Linux;

    const defaultConfig = file.json("share/hello/config.json", {
      city: "Mexico City",
      units: "metric",
      format: "compact",
    });

    const hello = program({
      name: "hello",
      version: "1.0.0",
      src: helloSrc[system],

      atBuild: isArm ? [pkgs.go] : [shared.packages.go_1_22],
      atTest: [pkgs.go],
      atRuntime: [pkgs.curl, pkgs.jq],

      build: "go build -o hello .",
      test: "go test ./...",
      files: [file.executable("bin/hello", "./hello"), defaultConfig],
      env: { HELLO_CONFIG: defaultConfig },

      description: "Says hello on the terminal",
      license: licenses.mit,
    });

    return { hello, default: hello };
  })

  .shells((system, { packages }) => {
    const qa = shell({
      packages: [pkgs.nodejs_22, pkgs.go, pkgs.vite, packages.hello],
      env: { HELLO: "THERE WE GO" },
      onEnter: 'echo "QA shell"',
    });

    const prod = shell({
      extends: qa,
      packages: [pkgs.gopls],
      env: { NODE_ENV: "production" },
    });

    return { qa, prod, default: qa };
  })

  .apps((system, { packages }) => ({
    hello: packages.hello, // uses its mainProgram
    loud: { program: packages.hello, args: ["--loud"] },
  }))

  .checks((system, { packages }) => ({
    build: packages.hello, // `nix flake check` builds it (and runs its tests)
  }))

  .formatter(() => pkgs.nixfmt_rfc_style)

  // System-independent outputs take no lambda.
  .templates({
    default: { path: "./template", description: "Starter project" },
  });
