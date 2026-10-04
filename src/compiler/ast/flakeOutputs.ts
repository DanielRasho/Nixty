import type { Input } from "./input.js"
import type { EmitContext, Node } from "./node.js"

/**
 * The outputs of the flake an input points to (`packages`, `devShells`, ...) rather than its files.
 *
 * It's written as the input's name, like the `Input` itself: in Nix a flake input is both its outputs
 * and its files. It is a node of its own so the walk phase can tell which inputs are flakes.
 */
export class FlakeOutputs implements Node {
    readonly input: Input
    readonly compound = false
    readonly suggestedName = null
    readonly system = null

    constructor(input: Input) {
        this.input = input
    }

    emit(ctx: EmitContext): string {
        return ctx.emit(this.input)
    }

    children(): Node[] {
        return [this.input]
    }
}
