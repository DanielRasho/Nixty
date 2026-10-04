import { attrName, indent } from "./format.js"
import type { EmitContext, Node } from "./node.js"

/** An attribute set: `{ pname = "hello"; version = "1.0"; }`, written one attribute per line. */
export class AttrSet implements Node {
    /** Written in this order. */
    readonly attrs: Record<string, Node>
    readonly compound = false
    readonly suggestedName = null
    readonly system = null

    constructor(attrs: Record<string, Node>) {
        this.attrs = attrs
    }

    emit(ctx: EmitContext): string {
        const entries = Object.entries(this.attrs)
        if (entries.length === 0) return "{ }"
        const lines = entries.map(([name, value]) => `  ${attrName(name)} = ${indent(ctx.emit(value))};`)
        return `{\n${lines.join("\n")}\n}`
    }

    children(): Node[] {
        return Object.values(this.attrs)
    }
}
