import { indent } from "./format.js"
import type { EmitContext, Node } from "./node.js"

/** Lists that fit in this many characters are written on one line. */
const INLINE_WIDTH = 60

/** A list: `[ pkgs.go pkgs.nodejs ]`. */
export class List implements Node {
    readonly items: Node[]
    readonly compound = false
    readonly suggestedName = null
    readonly system = null

    constructor(items: Node[]) {
        this.items = items
    }

    emit(ctx: EmitContext): string {
        if (this.items.length === 0) return "[ ]"
        const items = this.items.map((item) => ctx.operand(item))
        const inline = `[ ${items.join(" ")} ]`
        if (inline.length <= INLINE_WIDTH && !inline.includes("\n")) return inline
        return `[\n${items.map((item) => "  " + indent(item)).join("\n")}\n]`
    }

    children(): Node[] {
        return [...this.items]
    }
}
