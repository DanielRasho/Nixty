#!/usr/bin/env node

// Entry point for the `nixty` binary: argument parsing and dispatch only. Each command lives in
// src/commands/.
import { readFileSync, realpathSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { Command, CommanderError } from "commander"
import { generateCommand, type GenerateCommandOptions } from "./commands/generate.js"
import { handOver, localCli } from "./commands/handover.js"
import { nixCommand, type NixCommand } from "./commands/nix.js"
import { NixtyError } from "./compiler/errors.js"

// ../package.json from both src/cli.ts and dist/cli.js.
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }

const EXAMPLES = `
Examples:
  nixty generate               compile nixty.ts into flake.nix
  nixty develop dev            enter the dev shell "dev"
  nixty build WeatherCLI -L    build a package (nix's options go after the name)
  nixty run WeatherCLI --help  run a package (what follows the name goes to it)
  nixty command test           run a command
  nixty update                 move the inputs to their newest versions (flake.lock)`

/** Runs the CLI with `argv` (without `node` and the script) and returns the exit code. */
export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
    // Hand over before parsing, so the project's copy parses its own arguments: options can't be read
    // differently by two versions.
    const local = localCli(process.cwd())
    if (local !== null) return handOver(local, argv)

    // Actions can't return a value through Commander, so they report their exit code here.
    let code = 0
    const program = buildProgram((result) => {
        code = result
    })
    try {
        await program.parseAsync(argv, { from: "user" })
        return code
    } catch (error) {
        // Commander has already printed its message (or the help or version).
        if (error instanceof CommanderError) return error.exitCode
        if (error instanceof NixtyError) {
            console.error(`nixty: ${error.message}`)
            return 1
        }
        throw error
    }
}

/** A new program on every call: Commander keeps what it parsed on the Command objects. */
function buildProgram(exit: (code: number) => void): Command {
    // exitOverride and enablePositionalOptions must come before .command(): subcommands copy them.
    const program = new Command("nixty")
        .description("Write your Nix flake in TypeScript: nixty.ts in, flake.nix out.")
        .version(version)
        .exitOverride()
        .enablePositionalOptions()
        .showHelpAfterError("(run `nixty --help` for usage)")
        .addHelpText("after", EXAMPLES)

    program
        .command("generate")
        .description("compile nixty.ts into flake.nix")
        .argument("[file]", "the nixty file", "nixty.ts")
        .option("-o, --out <path>", "where to write the flake, - to print it (default: flake.nix next to the file)")
        .option("--no-typecheck", "skip the type-check")
        .action(async (file: string, options: GenerateCommandOptions) => {
            exit(await generateCommand(file, options))
        })

    // Commands handing off to nix. Only the name is nixty's: whatever follows it goes to nix (or, for
    // run and command, to the program), unchanged.
    const nix = (name: NixCommand, args: string, description: string): void => {
        program
            .command(name)
            .description(description)
            .arguments(args)
            .option("--no-generate", "use flake.nix as it is, without regenerating it from nixty.ts")
            .passThroughOptions()
            .allowUnknownOption()
            .allowExcessArguments()
            .action(async (...params: unknown[]) => {
                const command = params[params.length - 1] as Command
                const options = command.opts() as { generate: boolean }
                exit(await nixCommand(name, command.args, options.generate))
            })
    }
    nix("build", "<package> [nixArgs...]", "build a package (nix build)")
    nix("run", "<package> [args...]", "run a package's program (nix run)")
    nix("command", "<command> [args...]", "run a command (nix run)")
    nix("develop", "<shell> [nixArgs...]", "enter a dev shell (nix develop)")
    nix("update", "[inputs...]", "update the inputs' locked versions in flake.lock (nix flake update)")

    return program
}

// Only run when executed as the binary, not when imported (e.g. by tests). argv[1] may be a symlink
// (installs link the bin), so compare real paths.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
    // exitCode rather than exit(), so output still being written to a pipe isn't cut off.
    main().then((code) => {
        process.exitCode = code
    })
}
