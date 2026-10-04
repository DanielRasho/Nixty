import type { System } from "../constants.js"
import { NixtyError } from "../errors.js"
import type { EmitContext, Node, NodeOptions } from "./node.js"

/**
 * A function call: `fn a b`, e.g. `pkgs.writeText "name" "text"`. `import ./x` is a call too, of
 * `new Var("import")`.
 */
export class Call implements Node {
    readonly fn: Node
    readonly args: Node[]
    readonly compound = true
    readonly suggestedName: string | null
    readonly system: System | null

    constructor(fn: Node, args: Node[], options: NodeOptions = {}) {
        if (args.length === 0) throw new NixtyError("A Nix function must be called with at least one argument.")
        this.fn = fn
        this.args = args
        this.suggestedName = options.suggestedName ?? null
        this.system = options.system ?? null
    }

    emit(ctx: EmitContext): string {
        // Calls chain from the left (`f a b` is `(f a) b`), so a call as `fn` needs no parentheses.
        const fn = this.fn instanceof Call ? ctx.emit(this.fn) : ctx.operand(this.fn)
        return [fn, ...this.args.map((arg) => ctx.operand(arg))].join(" ")
    }

    children(): Node[] {
        return [this.fn, ...this.args]
    }
}
