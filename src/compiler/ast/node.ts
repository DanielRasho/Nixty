import type { System } from "../constants.js"

/**
 * One piece of Nix code, described rather than written. Nodes point to other nodes, so a definition
 * becomes a graph. The phases read it like this:
 *
 * - walk follows `children()` to find everything an output reaches: inputs, shared nodes, and nodes
 *   bound to a `system`.
 * - naming gives a name to every `Input`, and to every shared node that has a `suggestedName` or is
 *   a `Call` (so the call runs once).
 * - emit writes the graph through an `EmitContext`, which writes named nodes as their name.
 */
export interface Node {
    /** This node as Nix code. Children are written with `ctx.emit`/`ctx.operand`, never their own `emit`. */
    emit(ctx: EmitContext): string
    /** The nodes this one refers to directly. */
    children(): Node[]
    /**
     * Needs parentheses as a function argument, a list item or the left side of `.`:
     * `f (g x)`, `[ (g x) ]`, `(import ./x).y`.
     */
    readonly compound: boolean
    /**
     * The name this node would like. An `Input` is always named; any other node is bound with `let`
     * under this name when it's reached more than once. `null`: no preference (a shared `Call` is
     * still bound, under a made-up name).
     */
    readonly suggestedName: string | null
    /**
     * The only system this node is valid for, e.g. nixpkgs' packages for x86_64-linux. Reaching it
     * while building another system is an error. `null`: valid for any system.
     */
    readonly system: System | null
}

/** The optional `suggestedName` and `system` of the nodes that take them (`Call`, `Select`). */
export interface NodeOptions {
    suggestedName?: string | null
    system?: System | null
}

/**
 * Writes nodes as Nix code. The emit phase makes one with the names the naming phase chose: every
 * input, and the shared nodes bound with `let`. A named node is written as its name, any other as
 * its own code.
 *
 * To write a `let` line (`pkgs = <code>;`), call `node.emit(ctx)` directly, since `ctx.emit(node)`
 * would give back the name.
 */
export class EmitContext {
    readonly names: Map<Node, string>

    constructor(names: Map<Node, string>) {
        this.names = names
    }

    /** The node's name, or its code if it has none. */
    emit(node: Node): string {
        return this.names.get(node) ?? node.emit(this)
    }

    /**
     * Like `emit`, in parentheses when the node is compound and has no name. For function arguments,
     * list items and the left side of `.`.
     */
    operand(node: Node): string {
        const name = this.names.get(node)
        if (name !== undefined) return name
        const code = node.emit(this)
        return node.compound ? `(${code})` : code
    }
}
