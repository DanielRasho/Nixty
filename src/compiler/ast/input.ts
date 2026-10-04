import type { EmitContext, Node } from "./node.js"

/**
 * Something the flake fetches, such as nixpkgs or a git repository. It becomes an entry of the
 * flake's `inputs`, and the code refers to it by that entry's name:
 *
 *     inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";    <- url
 *     ... import nixpkgs { ... } ...                                <- how the node is written
 *
 * The naming phase names every input, starting from `suggestedName`. Whether it's read as a flake is
 * up to the walk phase: it is when a `FlakeOutputs` node reaches it, and otherwise it's declared with
 * `flake = false`, which works for any source.
 */
export class Input implements Node {
    /** Flake reference, e.g. `github:NixOS/nixpkgs/nixos-25.05` or `path:/etc/nixos`. */
    readonly url: string
    readonly compound = false
    readonly suggestedName: string
    readonly system = null

    constructor(url: string, suggestedName: string) {
        this.url = url
        this.suggestedName = suggestedName
    }

    emit(_ctx: EmitContext): string {
        // EmitContext writes named nodes by name without calling this.
        throw new Error(`input "${this.url}" has no name; the naming phase must name every input`)
    }

    children(): Node[] {
        return []
    }
}
