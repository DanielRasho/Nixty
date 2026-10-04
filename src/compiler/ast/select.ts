import type { System } from "../constants.js"
import { attrName } from "./format.js"
import type { EmitContext, Node, NodeOptions } from "./node.js"

/** Attribute access: `from.a.b`, e.g. `pkgs.stdenv.mkDerivation`. */
export class Select implements Node {
    readonly from: Node
    /** The attribute names, outermost first. */
    readonly path: string[]
    readonly compound = false
    readonly suggestedName: string | null
    readonly system: System | null

    constructor(from: Node, path: string[], options: NodeOptions = {}) {
        if (path.length === 0) throw new Error("Select needs at least one attribute name")
        this.from = from
        this.path = path
        this.suggestedName = options.suggestedName ?? null
        this.system = options.system ?? null
    }

    emit(ctx: EmitContext): string {
        return `${ctx.operand(this.from)}.${this.path.map(attrName).join(".")}`
    }

    children(): Node[] {
        return [this.from]
    }
}
