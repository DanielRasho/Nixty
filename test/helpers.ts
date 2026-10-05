import { Input } from "../src/compiler/ast/input.js"
import { EmitContext, type Node } from "../src/compiler/ast/node.js"

/** Writes a node as Nix code, with `names` for inputs and `let`-bound nodes. */
export function emit(node: Node, names: Map<Node, string> = new Map()): string {
    return new EmitContext(names).emit(node)
}

/** Like `emit`, naming every input `node` reaches after its `suggestedName`. */
export function emitNamed(node: Node): string {
    const names = new Map<Node, string>()
    const visit = (n: Node): void => {
        if (n instanceof Input) names.set(n, n.suggestedName)
        n.children().forEach(visit)
    }
    visit(node)
    return emit(node, names)
}
