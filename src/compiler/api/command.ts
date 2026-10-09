import type { System } from "../constants.js";
import { NixtyError } from "../errors.js";
import type { DevShell } from "./devShell.js";
import type { Package } from "./package.js";
import { VALID_DERIVATION_NAME, type Derivation, type NixString } from "./primitives.js";

/**
 * A named task you run with `nixty run <name>`, like an npm script. You specify the packages needed to run it
 * Everyone who runs it, teammates or CI, gets the exact same tool versions.
 *
 *     new Command({
 *         name: "test",
 *         systems: [System.x86_64Linux],
 *         packages: (system) => [nodejs],
 *         command: "npm test",
 *     })
 *
 * Unlike a `DevShell`, it doesn't leave you in a terminal; unlike a `Package`, nothing is
 * installed. It becomes one of the flake's `apps`.
 */
export class Command {
    readonly name: string;
    readonly systems: readonly System[];
    readonly packages: (system: System) => Derivation[];
    readonly env: Record<string, string | NixString>;
    readonly command: string | NixString;

    constructor({
        name,
        systems,
        packages,
        env = {},
        command
    }: CommandDefinition) {
        if (name.trim() === "")
            throw new NixtyError("A dev shell needs a name.")
        if (typeof command === "string" && command.trim() === "")
            throw new NixtyError("A dev shell needs a not empty command.")
        if (!VALID_DERIVATION_NAME.test(name))
            throw new NixtyError(`"${name}" is not a valid dev shell name: use only letters, digits and + - . _ ? =`)
        this.name = name;
        this.systems = systems
        this.packages = packages
        this.env = env
        this.command = command
    }

    /** Returns the tools available while the command runs for `system`. */
    getPackages(system: System) : Derivation[] {
        if (!this.systems.includes(system))
            throw new NixtyError(`${this.name} shell does not support system ${system}.\n\tAdd it to systems attribute`)
        return this.packages(system)
    }
}

export interface CommandDefinition {
    /** What you type to run it: `nixty run <name>`. */
    name: string;
    /** The systems it can run on (e.g. Linux, macOS). */
    systems: readonly System[];
    /** The tools available during command execution, for the given system. */
    packages: (system: System) => Derivation[];
    /** Environment variables set inside the shell, e.g. `{ PORT: "8080" }`. */
    env?: Record<string, string | NixString>;
    /**
     * Shell script to run `echo "hello world"`. Arguments after the name (`nixty command <name> a b`)
     * are only used where the script says: write `"$@"` to pass them on, e.g. `shellcheck "$@"`.
     */
    command: string | NixString;
}
