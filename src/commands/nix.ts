// The commands that hand off to the user's own `nix`: nixty never reimplements what nix does. Each one
// regenerates flake.nix first, so `nix` always sees the current nixty.ts.
import { join } from "node:path"
import { generate } from "../compiler/compiler.js"
import { attrName } from "../compiler/ast/format.js"
import { System } from "../compiler/constants.js"
import { NixtyError } from "../compiler/errors.js"
import { findUp } from "../compiler/phases/typecheck.js"
import { runInForeground } from "./foreground.js"
import { warnIfUntracked } from "./generate.js"

export type NixCommand = "build" | "run" | "command" | "develop" | "update"

/** The file that marks a nixty project. */
const NIXTY_FILE = "nixty.ts"

/** Node's `platform arch` -> the Nix system it runs. */
const SYSTEMS: Record<string, System> = {
    "linux x64": System.x86_64Linux,
    "linux arm64": System.aarch64Linux,
    "darwin x64": System.x86_64Darwin,
    "darwin arm64": System.aarch64Darwin,
}

/**
 * Runs `command` on the project around the current folder: regenerates its flake.nix (unless
 * `generateFirst` is false), then runs `nix`. Returns nix's exit code.
 */
export async function nixCommand(command: NixCommand, args: string[], generateFirst: boolean): Promise<number> {
    const cwd = process.cwd()
    const dir = findUp(cwd, NIXTY_FILE)
    if (dir === null)
        throw new NixtyError(`No ${NIXTY_FILE} in this folder or any above it. Write one, then run this again.`)
    if (generateFirst) {
        await generate({ file: join(dir, NIXTY_FILE), out: join(dir, "flake.nix") })
        warnIfUntracked(join(dir, "flake.nix"))
    }
    const flake = dir === cwd ? "." : dir
    return runNix(nixArgs(command, flake, currentSystem(), args))
}

/**
 * The `nix` arguments for a command. Outputs are picked by their full path, so a package, a shell and
 * a command can share a name:
 *
 *     build WeatherCLI -L   ->  nix build .#packages.<system>.WeatherCLI -L
 *     run WeatherCLI a b    ->  nix run .#packages.<system>.WeatherCLI -- a b
 *     command test a        ->  nix run .#apps.<system>.test -- a
 *     develop dev           ->  nix develop .#devShells.<system>.dev
 *     update nixpkgs        ->  nix flake update --flake . nixpkgs
 */
export function nixArgs(command: NixCommand, flake: string, system: System, args: string[]): string[] {
    const features = ["--extra-experimental-features", "nix-command flakes"]
    if (command === "update") return [...features, "flake", "update", "--flake", flake, ...args]

    const [name, ...rest] = args
    if (name === undefined || name.startsWith("-"))
        throw new NixtyError(`Write the name first and nix's options after it: nixty ${command} <name> ${args.join(" ")}`.trim())
    const target = (category: string): string => `${flake}#${category}.${system}.${attrName(name)}`
    switch (command) {
        case "build":
            return [...features, "build", target("packages"), ...rest]
        case "develop":
            return [...features, "develop", target("devShells"), ...rest]
        // Everything after the name goes to the program, not to nix.
        case "run":
            return [...features, "run", target("packages"), "--", ...rest]
        case "command":
            return [...features, "run", target("apps"), "--", ...rest]
    }
}

/** The Nix system of this machine. */
export function currentSystem(): System {
    const system = SYSTEMS[`${process.platform} ${process.arch}`]
    if (system === undefined)
        throw new NixtyError(`Nixty doesn't support this machine (${process.platform} ${process.arch}).`)
    return system
}

/** Runs `nix` with this terminal and resolves with its exit code. */
async function runNix(args: string[]): Promise<number> {
    try {
        return await runInForeground("nix", args)
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
            throw new NixtyError("`nix` was not found. Install Nix: https://nixos.org/download")
        throw error
    }
}
