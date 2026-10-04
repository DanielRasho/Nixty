import type { Input } from "../../ast/input.js"
import type { Node } from "../../ast/node.js"
import type { Nixpkgs } from "../../api/helpers.js"
import type { System } from "../../constants.js"

/**
 * What expand needs while turning one system's outputs into nodes. It only converts: finding what is
 * shared or which inputs are flakes is left to walk.
 */
export class ExpandContext {
    /** The system being expanded. */
    readonly system: System
    /** The nixpkgs whose builders (`stdenv.mkDerivation`, `mkShell`, ...) build the outputs. */
    readonly nixpkgs: Nixpkgs
    /**
     * The node made for each API object (`Expresion`, `Path`, `Derivation`, ...). Asking twice for the
     * same object gives the same node, so walk can tell it's shared.
     */
    readonly nodes: Map<object, Node>
    /** The node of each EXTERNAL derivation, by its `Expresion`: `getPackages` makes a new
     *  `Derivation` on every call, but the same package always comes from the same `Expresion`. */
    readonly externals: Map<object, Node>
    /** One input per URL, shared by every system: fetching the same thing twice is one input. */
    readonly inputs: Map<string, Input>

    constructor(system: System, nixpkgs: Nixpkgs, inputs: Map<string, Input>) {
        this.system = system
        this.nixpkgs = nixpkgs
        this.nodes = new Map()
        this.externals = new Map()
        this.inputs = inputs
    }
}
