import { isIdentifier } from "./format.js"
import type { EmitContext, Node } from "./node.js"

/**
 * A name that is in scope where the code runs: `self`, `builtins`, `import`, ... In Nix `true`,
 * `false` and `null` are names too, so they're written with this node.
 */
export class Var implements Node {
    readonly name: string
    readonly compound = false
    readonly suggestedName = null
    readonly system = null

    constructor(name: string) {
        if (!isIdentifier(name)) throw new Error(`"${name}" is not a valid Nix name`)
        this.name = name
    }

    emit(_ctx: EmitContext): string {
        return this.name
    }

    children(): Node[] {
        return []
    }
}
