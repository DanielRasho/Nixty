import { NixtyError } from "../errors.js"
import type { EmitContext, Node } from "./node.js"

/** A number: `3`, `-1`, `0.5`. */
export class Num implements Node {
    readonly value: number
    readonly compound: boolean
    readonly suggestedName = null
    readonly system = null

    constructor(value: number) {
        if (!Number.isFinite(value)) throw new NixtyError(`${value} can't be written as a Nix number.`)
        this.value = value
        // `f -1` is read as `f - 1`, and `[ -1 ]` doesn't parse, so a negative number needs parentheses.
        this.compound = value < 0
    }

    emit(_ctx: EmitContext): string {
        const text = String(this.value)
        // Nix needs a dot before an exponent: `1.0e-7`, not `1e-7`.
        return text.includes("e") && !text.includes(".") ? text.replace("e", ".0e") : text
    }

    children(): Node[] {
        return []
    }
}
