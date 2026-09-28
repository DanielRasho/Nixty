import { definition, input } from "nixty-lib"
import { each as variants } from "nixty-lib/utils"
import { pkg, devShell, licenses, systems } from "nixty-lib/derivation"

const NIX_PKGS = input.registry("github:NixOS/nixpkgs/nixos-25.05")
const SHARED_PKGS = input.path("./shared")

const P = project({
  description: "A definition for this project",
  systems: [systems.x86_64Linux, systems.aarch64Linux],
});

P.outputs((system) => {
  const isArm = system === systems.aarch64Linux;

  const defaultConfig = file.json("share/hello/config.json", {
    city: "Mexico City",
    units: "metric",
    format: "compact",
  });

  const hello = pkg({
    name: "hello",
    version: "1.0.0",
    system: system,
    src: input.path("./"),
    deps : {
        atBuild:    [NIX_PKGS.nodejs_22],
        atRuntime:  [NIX_PKGS.nodejs_22],
        atTest:     [NIX_PKGS.nodejs_22],
        linked: system === systems.aarch64Linux ? [NIX_PKGS.go] : [SHARED_PKGS.go_1_22],
        linkedAndExported: [ 
          NIX_PKGS.curl, 
          NIX_PKGS.jq
        ],
    },
    phases: (out) => ({
        build: `npm ${out}/bin build && install ${DefaultConfig}`,
        install : "npm install"
    }),
    meta: { 
        description: "Says hello on the terminal", 
        license: licenses.mit, 
        mainProgram: "hello" 
    },
  });

  const qa = devShell({
    name: "QA",
    packages: [pkgs.vitest, hello],
    env: { HELLO: "THERE WE GO" },
    onEnter: 'echo "QA shell"',
  });

  const prod = devShell({
    name: "Default",
    extends: qa,
    packages: [pkgs.gopls],
    env: { NODE_ENV: "production" },
  });

  return {
    packages: { hello, default: hello },
    shells: { qa, prod, default: qa },
  };
})

export default P;