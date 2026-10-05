// A command: a script with its own tools, run without installing anything.
// Try it: `nixty command greet`, or `nixty command greet Ana` (what follows the name goes to the script).
import { Command, Definition, Nixpkgs, System } from "nixty-lib"

const SYSTEMS = [System.x86_64Linux]

const NIX_PKGS = new Nixpkgs({ tag: "nixos-25.05" })

const greet = new Command({
    name: "greet",
    systems: SYSTEMS,
    packages: (system) => NIX_PKGS.getPackages(["figlet", "cowsay", "coreutils"], system),
    env: { GREETING: "Hello" },
    command: `
name="\${1:-world}"
figlet "$GREETING, $name"
echo "Today is $(date +%A)" | cowsay
`,
})

export default new Definition({
    description: "Example 03: a command",
    nixpkgs: NIX_PKGS,
    commands: [greet],
})
