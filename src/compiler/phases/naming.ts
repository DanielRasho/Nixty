// Phase "naming": give every input and `let` binding its Nix name, resolving clashes once, before any
// text exists.
import { Call } from "../ast/call.js"
import { isIdentifier } from "../ast/format.js"
import { Input } from "../ast/input.js"
import type { Node } from "../ast/node.js"
import { Select } from "../ast/select.js"
import type { System } from "../constants.js"
import type { SystemFacts, WalkResult } from "./walk.js"

/** Names the generated flake uses itself, or that would hide one of Nix's. */
const RESERVED = ["self", "perSystem", "builtins", "import", "true", "false", "null"]

export interface Names {
    inputs: Map<Input, string>
    /** The `let` names of each system's shared nodes. */
    lets: Map<System, Map<Node, string>>
}

export function chooseNames(walked: WalkResult): Names {
    const inputs = new Map<Input, string>()
    const taken = new Set(RESERVED)
    for (const input of walked.inputs) inputs.set(input, claim(taken, identifier(input.suggestedName)))

    const lets = new Map<System, Map<Node, string>>()
    for (const facts of walked.systems) lets.set(facts.system, letNames(facts, [...RESERVED, ...inputs.values()]))
    return { inputs, lets }
}

/**
 * `let` names for one system: shared nodes that suggest a name, and shared calls (bound so the call
 * runs once), named after the function they call.
 */
function letNames(facts: SystemFacts, reserved: string[]): Map<Node, string> {
    const taken = new Set(reserved)
    const lets = new Map<Node, string>()
    for (const node of facts.order) {
        if ((facts.uses.get(node) ?? 0) < 2 || node instanceof Input) continue
        const name = node.suggestedName ?? (node instanceof Call ? calledName(node) : null)
        if (name !== null) lets.set(node, claim(taken, identifier(name)))
    }
    return lets
}

/** The name of the function `call` calls: `writeText` for `pkgs.writeText "a" "b"`. */
function calledName(call: Call): string {
    let fn = call.fn
    while (fn instanceof Call) fn = fn.fn
    return fn instanceof Select ? fn.path[fn.path.length - 1] : "value"
}

/** `name` made into a valid Nix identifier: `my app` -> `my-app`, `2fa` -> `fa`. */
function identifier(name: string): string {
    const cleaned = name.replace(/[^a-zA-Z0-9_'-]/g, "-").replace(/^[^a-zA-Z_]+/, "")
    if (cleaned === "") return "value"
    return isIdentifier(cleaned) ? cleaned : `${cleaned}_`
}

/** `base`, or `base_2`, `base_3`, ... if it's taken. */
function claim(taken: Set<string>, base: string): string {
    let name = base
    for (let n = 2; taken.has(name); n++) name = `${base}_${n}`
    taken.add(name)
    return name
}
