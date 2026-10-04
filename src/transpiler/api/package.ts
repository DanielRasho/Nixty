import { System } from "../constants.js";
import { NixtyError } from "../errors.js";
import { Derivation, VALID_DERIVATION_NAME, type DerivationDefinition, type DerivationDeps } from "./primitives.js";

/**
 * A program that can be built for several systems (e.g. Linux and macOS).
 * `definition` says how to build it for one system; Nixty calls it once for each system in `systems`.
 * 
 * For Nix users: one derivation per system, all from the same recipe, using `mkDerivation` .
 */
export class Package{
    readonly name: string;
    readonly systems: readonly System[];
    readonly definition: (system: System) => DerivationDefinition;
    // One derivation per system, built on first use. The compiler finds shared dependencies by
    // object identity, so asking twice must return the same object.
    #derivations = new Map<System, Derivation>();

    constructor(
        name: string,
        systems: System[],
        definition: (system: System) => DerivationDefinition) {
        if (name.trim() === "")
            throw new NixtyError("A package needs a name.")
        if (!VALID_DERIVATION_NAME.test(name))
            throw new NixtyError(`"${name}" is not a valid package name: use only letters, digits and + - . _ ? =`)
        this.name = name;
        this.systems = [...new Set(systems)]; // Copy, dropping duplicates
        this.definition = definition;
    }

    /** Returns the package's dependencies for an specific system. */
    getDependencies(system: System) : DerivationDeps{
        return this.#definitionFor(system).deps
    }

    /** Returns a concrete Derivation (Recipe) to build this program in a specific system. */
    getDerivation(system: System) : Derivation {
        let d = this.#derivations.get(system)
        if (!d) {
            d = Derivation.fromDefinition(this.name, system, this.#definitionFor(system))
            this.#derivations.set(system, d)
        }
        return d
    }

    /** Returns the list of Derivations this packages supports*/
    getDerivations() : Derivation[] {
        return this.systems.map(s => this.getDerivation(s))
    }

        // Returns a derivation for a system if supported
    #definitionFor(system: System) : DerivationDefinition {
        if (!this.systems.includes(system))
            throw new NixtyError(`${this.name} package does not support system ${system}.\n\tAdd it to systems attribute`)
        return this.definition(system)
    }
}
