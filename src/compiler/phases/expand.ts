// Phase "expand": call every recipe once per system and turn what it returns into nodes, giving one
// graph per system. It only converts; walk finds what is shared.
import type { Input } from "../ast/input.js"
import type { Node } from "../ast/node.js"
import type { Definition } from "../api/definition.js"
import { Package } from "../api/package.js"
import { Derivation } from "../api/primitives.js"
import { System } from "../constants.js"
import { NixtyError } from "../errors.js"
import { commandNode } from "./expand/command.js"
import { ExpandContext } from "./expand/context.js"
import { devShellNode } from "./expand/devShell.js"
import { derivationNode } from "./expand/values.js"

/** The flake outputs Nixty writes, in the order they're written. */
export type Category = "packages" | "devShells" | "apps"
export const CATEGORIES: Category[] = ["packages", "devShells", "apps"]

/** One output for one system, e.g. `packages.<system>.WeatherCLI`. */
export interface Output {
    category: Category
    name: string
    node: Node
}

/** Everything one system builds. */
export interface SystemGraph {
    system: System
    outputs: Output[]
}

/** One graph per system any output supports, in the order of `System`. */
export function expand(definition: Definition): SystemGraph[] {
    const inputs = new Map<string, Input>()
    return systemsOf(definition).map((system) => {
        const ctx = new ExpandContext(system, definition.nixpkgs, inputs)
        const outputs: Output[] = []
        const add = (category: Category, name: string, make: () => Node): void => {
            if (outputs.some((o) => o.category === category && o.name === name))
                throw new NixtyError(`Two ${category} are named "${name}"; each needs its own name.`)
            outputs.push({ category, name, node: inContext(`${category}.${name} (${system})`, make) })
        }

        for (const p of definition.packages) {
            if (p instanceof Package) {
                if (p.systems.includes(system)) add("packages", p.name, () => derivationNode(ctx, p.getDerivation(system)))
                continue
            }
            if (p.system() !== system) continue
            const name = p.name()
            if (name === null)
                throw new NixtyError("A derivation in `packages` needs a name: pass one to Derivation.fromExpresion.")
            add("packages", name, () => derivationNode(ctx, p))
        }
        for (const shell of definition.devShells) {
            if (shell.systems.includes(system)) add("devShells", shell.name, () => devShellNode(ctx, shell))
        }
        for (const command of definition.commands) {
            if (command.systems.includes(system)) add("apps", command.name, () => commandNode(ctx, command))
        }
        return { system, outputs }
    })
}

/** The systems at least one output supports. */
function systemsOf(definition: Definition): System[] {
    const used = new Set<System>()
    for (const p of definition.packages) {
        if (p instanceof Derivation) {
            const system = p.system()
            if (system !== null) used.add(system)
        } else {
            p.systems.forEach((s) => used.add(s))
        }
    }
    definition.devShells.forEach((shell) => shell.systems.forEach((s) => used.add(s)))
    definition.commands.forEach((command) => command.systems.forEach((s) => used.add(s)))
    return Object.values(System).filter((s) => used.has(s))
}

/** Runs a recipe, adding which output and system failed to any error it throws. */
function inContext(where: string, make: () => Node): Node {
    try {
        return make()
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new NixtyError(`${where}: ${message}`, { cause: error })
    }
}
