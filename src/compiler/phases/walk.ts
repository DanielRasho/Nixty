// Phase "walk": follow children() through each system's graph, visiting each node once, and collect
// the facts naming and emit need. Nothing is written here; this is where user mistakes are found.
import { FlakeOutputs } from "../ast/flakeOutputs.js"
import { Input } from "../ast/input.js"
import type { Node } from "../ast/node.js"
import type { System } from "../constants.js"
import { NixtyError } from "../errors.js"
import type { SystemGraph } from "./expand.js"

/** What walking one system's graph found. */
export interface SystemFacts {
    system: System
    /** How many times each node is reached. Shared nodes (more than once) may become `let`s. */
    uses: Map<Node, number>
    /** Every node reached, children before parents, so a `let` comes after the ones it uses. */
    order: Node[]
}

export interface WalkResult {
    /** Inputs reached from some output, in the order first reached. Unreached inputs are left out. */
    inputs: Input[]
    /** The inputs read as flakes (reached through `FlakeOutputs`). Every other one is `flake = false`. */
    flakeInputs: Set<Input>
    systems: SystemFacts[]
}

export function walk(graphs: SystemGraph[]): WalkResult {
    const inputs = new Set<Input>()
    const flakeInputs = new Set<Input>()
    const systems: SystemFacts[] = []
    const problems: string[] = []

    for (const { system, outputs } of graphs) {
        const uses = new Map<Node, number>()
        const order: Node[] = []
        for (const output of outputs) {
            const where = `${output.category}.${output.name} (${system})`
            const visit = (node: Node): void => {
                const count = (uses.get(node) ?? 0) + 1
                uses.set(node, count)
                if (count > 1) return

                if (node.system !== null && node.system !== system) {
                    problems.push(
                        `${where} uses a value made for ${node.system}. ` +
                            "Use the `system` the recipe receives instead of a fixed one.",
                    )
                }
                if (node instanceof Input) inputs.add(node)
                if (node instanceof FlakeOutputs) flakeInputs.add(node.input)

                node.children().forEach(visit)
                order.push(node)
            }
            visit(output.node)
        }
        systems.push({ system, uses, order })
    }

    if (problems.length > 0) throw new NixtyError(problems.join("\n"))
    return { inputs: [...inputs], flakeInputs, systems }
}
