import type { System } from "../constants.js";
import { NixtyError } from "../errors.js";
import { VALID_DERIVATION_NAME, type Derivation, type NixString } from "./primitives.js";

/**
 * A terminal with the tools you specify (compilers, CLIs, ...) ready to use.
 * Everyone who enters it, teammates or CI, gets the exact same versions.
 *
 * Enter it with `nixty develop <name>`. Like Python's virtualenv, but for any tool.
 */
export class DevShell {
    readonly name: string;
    readonly extends: DevShell | undefined;
    readonly systems: readonly System[];
    readonly packages: (system: System) => Derivation[];
    readonly env: Record<string, string | NixString>;
    readonly onEnter: string | NixString;

    constructor({
        name,
        extends: parent, // `extends` is reserved, so bind it to a different local name
        systems,
        packages,
        env,
        onEnter,
    }: DevShellDefinition) {
        if (name.trim() === "")
            throw new NixtyError("A dev shell needs a name.")
        if (!VALID_DERIVATION_NAME.test(name))
            throw new NixtyError(`"${name}" is not a valid dev shell name: use only letters, digits and + - . _ ? =`)
        if (!parent && !systems)
            throw new NixtyError(`Dev shell ${name} needs \`systems\`, or \`extends\` to inherit from another shell's.`)
        if (!parent && !packages)
            throw new NixtyError(`Dev shell ${name} needs \`packages\`, or \`extends\` to inherit from another shell's.`)
        this.name = name;
        this.extends = parent;
        // Join the parent's systems with this one's (a Set drops duplicates). Anything else given
        // here replaces the parent's; for `env`, only the keys given here.
        this.systems = [...new Set([...(parent?.systems ?? []), ...(systems ?? [])])];
        this.packages = (packages ?? parent?.packages)!; // one of them is set, checked above
        this.env = { ...parent?.env, ...env };
        this.onEnter = onEnter ?? parent?.onEnter ?? "";
    }

    /** Returns the tools available in this shell on `system`. */
    getPackages(system: System) : Derivation[] {
        if (!this.systems.includes(system))
            throw new NixtyError(`${this.name} shell does not support system ${system}.\n\tAdd it to systems attribute`)
        return this.packages(system)
    }

    node() {
        // TODO:
    }
}

export interface DevShellDefinition {
    /** What you type to enter it: `nixty develop <name>`. */
    name: string;
    /**
    * Start as a copy of another shell. Anything you leave out stays as
    * in the original; what you write overwrites it, except `systems`, which are added to the copy's.
    * The other shell isn't changed.
    */
    extends?: DevShell;
    /** The systems this shell works on (e.g. Linux, macOS). Required unless `extends` is set. */
    systems?: readonly System[];
    /** The tools available inside the shell, for the given system. Required unless `extends` is set. */
    packages?: (system: System) => Derivation[];
    /** Environment variables set inside the shell, e.g. `{ PORT: "8080" }`. */
    env?: Record<string, string | NixString>;
    /** Shell commands run each time you enter it, e.g. `echo "Welcome"`. */
    onEnter?: string | NixString;
}
