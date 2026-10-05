// A dev shell with Node.js and a few CLI tools, plus a second shell built on top of it.
// Try it: `nixty develop dev`, then `node --version`. Or `nixty develop ci` to also get shellcheck.
import { Definition, DevShell, Nixpkgs, System } from "nixty-lib"

const SYSTEMS = [System.x86_64Linux]

const NIX_PKGS = new Nixpkgs({ tag: "nixos-25.05" })

const dev = new DevShell({
    name: "dev",
    systems: SYSTEMS,
    packages: (system) => NIX_PKGS.getPackages(["nodejs_22", "jq", "ripgrep"], system),
    env: { NODE_ENV: "development" },
    onEnter: `echo "dev shell: node $(node --version)"`,
})

// A copy of `dev` with other tools and NODE_ENV changed; its onEnter is kept.
const ci = new DevShell({
    name: "ci",
    extends: dev,
    packages: (system) => NIX_PKGS.getPackages(["nodejs_22", "shellcheck"], system),
    env: { NODE_ENV: "test" },
})

export default new Definition({
    description: "Example 01: dev shells",
    nixpkgs: NIX_PKGS,
    devShells: [dev, ci],
})
