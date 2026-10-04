// Turns the values an output holds (strings, paths, expressions, derivations, ...) into nodes.
import { AttrSet } from "../../ast/attrSet.js"
import { Call } from "../../ast/call.js"
import { FlakeOutputs } from "../../ast/flakeOutputs.js"
import { Input } from "../../ast/input.js"
import { List } from "../../ast/list.js"
import type { Node, NodeOptions } from "../../ast/node.js"
import { Num } from "../../ast/num.js"
import { PathLiteral } from "../../ast/pathLiteral.js"
import { Select } from "../../ast/select.js"
import { Str } from "../../ast/str.js"
import { Var } from "../../ast/var.js"
import {
    Derivation,
    DerivationKind,
    Expresion,
    NixString,
    Path,
    Source,
    type ExpresionStep,
    type NixArg,
} from "../../api/primitives.js"
import { NixtyError } from "../../errors.js"
import type { ExpandContext } from "./context.js"
import { packageNode } from "./package.js"

/** Anything an output can hold. */
export type Value = NixArg | Derivation | Source

/** `value` as a node. Plain JS values become literals, API objects the code they stand for. */
export function valueNode(ctx: ExpandContext, value: Value): Node {
    // First: an `Expresion` is a Proxy that answers every property, so it would pass the checks below.
    if (value instanceof Expresion) return expresionNode(ctx, value)
    if (typeof value === "string") return new Str([value])
    if (typeof value === "number") return new Num(value)
    if (typeof value === "boolean") return new Var(value ? "true" : "false")
    if (value === null) return new Var("null")
    if (value instanceof Path) return pathNode(ctx, value)
    if (value instanceof Source) return pathNode(ctx, Source.pathOf(value))
    if (value instanceof NixString) return strNode(ctx, value)
    if (value instanceof Derivation) return derivationNode(ctx, value)
    if (Array.isArray(value)) return new List(value.map((item) => valueNode(ctx, item)))
    if (isPlainObject(value)) {
        const attrs: Record<string, Node> = {}
        for (const [name, item] of Object.entries(value)) {
            // `{ a: undefined }` is written like `{}`, as `JSON.stringify` does.
            if (item !== undefined) attrs[name] = valueNode(ctx, item)
        }
        return new AttrSet(attrs)
    }
    throw new NixtyError(`${describe(value)} can't be written in Nix.`)
}

/** pkgs.<path> of the definition's nixpkgs, e.g. `pkgsNode(ctx, "stdenv.mkDerivation")`. */
export function pkgsNode(ctx: ExpandContext, path: string): Node {
    return expresionNode(ctx, ctx.nixpkgs.getExpresion(path, ctx.system))
}

/** The node of a NixString: its text with the values inside written as `${...}`. */
export function strNode(ctx: ExpandContext, str: NixString): Node {
    return cached(ctx.nodes, str, () => {
        const { strings, values } = NixString.partsOf(str)
        const pieces: (string | Node)[] = [strings[0]]
        values.forEach((value, i) => {
            // Nix can't put a number inside a string (`"${1}"` fails), so it goes in as text.
            if (typeof value === "string" || typeof value === "number") pieces.push(String(value))
            else pieces.push(valueNode(ctx, value))
            pieces.push(strings[i + 1])
        })
        return new Str(pieces)
    })
}

/** A path inside the project as a path literal (`./src`), a fetched one as its input. */
export function pathNode(ctx: ExpandContext, path: Path): Node {
    return cached(ctx.nodes, path, () => {
        const local = localPath(path)
        if (local !== null) return new PathLiteral(local)
        const location = Path.locationOf(path)
        switch (location.kind) {
            case "input": {
                let input = ctx.inputs.get(location.url)
                if (input === undefined) {
                    input = new Input(location.url, location.suggestedName)
                    ctx.inputs.set(location.url, input)
                }
                return input
            }
            case "sub":
                // `"${nixpkgs}/lib"`: Nix reads a string made from a path as that path.
                return new Str([pathNode(ctx, location.parent), "/" + location.subpath])
            case "local":
                throw new Error("unreachable: local paths are handled by localPath")
        }
    })
}

/** The path relative to the project if `path` is inside it, e.g. `src/lib`; `null` if it's fetched. */
function localPath(path: Path): string | null {
    const location = Path.locationOf(path)
    switch (location.kind) {
        case "local":
            return location.path
        case "input":
            return null
        case "sub": {
            const parent = localPath(location.parent)
            return parent === null ? null : `${parent}/${location.subpath}`
        }
    }
}

/** The node of an `Expresion`, made from the steps recorded on it. */
export function expresionNode(ctx: ExpandContext, expr: Expresion): Node {
    return cached(ctx.nodes, expr, () => stepNode(ctx, Expresion.stepOf(expr), {}))
}

/**
 * The node of a derivation. An INTERNAL one is a `mkDerivation` call; an EXTERNAL one is its
 * expression, carrying the derivation's name and system.
 */
export function derivationNode(ctx: ExpandContext, d: Derivation): Node {
    const parts = Derivation.partsOf(d)
    const options: NodeOptions = { suggestedName: parts.name, system: parts.system }
    if (parts.kind === DerivationKind.INTERNAL) {
        // Package.getDerivation gives the same object on every call, so it's cached by the derivation.
        return cached(ctx.nodes, d, () => packageNode(ctx, parts.name!, parts.definition!, options))
    }
    const expr = parts.expresion!
    return cached(ctx.externals, expr, () => stepNode(ctx, Expresion.stepOf(expr), options))
}

/** One step of an `Expresion` as a node. `options` go on this node only, not on the ones it's built on. */
function stepNode(ctx: ExpandContext, step: ExpresionStep, options: NodeOptions): Node {
    switch (step.kind) {
        case "import":
            return new Call(new Var("import"), [pathNode(ctx, step.path)], options)
        case "flake": {
            const input = pathNode(ctx, step.path)
            if (!(input instanceof Input))
                throw new NixtyError("Only a fetched path can be read as a flake, not a path inside the project.")
            return new FlakeOutputs(input)
        }
        case "attr":
            return new Select(expresionNode(ctx, step.of), [step.name], options)
        case "index": {
            const elemAt = new Select(new Var("builtins"), ["elemAt"])
            return new Call(elemAt, [expresionNode(ctx, step.of), new Num(step.index)], options)
        }
        case "call": {
            const args = step.args.map((arg) => valueNode(ctx, arg))
            const suggestedName = options.suggestedName ?? step.suggestedName
            return new Call(expresionNode(ctx, step.fn), args, { ...options, suggestedName })
        }
    }
}

function cached(nodes: Map<object, Node>, key: object, make: () => Node): Node {
    let node = nodes.get(key)
    if (node === undefined) {
        node = make()
        nodes.set(key, node)
    }
    return node
}

function isPlainObject(value: object): value is Record<string, Value | undefined> {
    const proto = Object.getPrototypeOf(value)
    return proto === Object.prototype || proto === null
}

/** How to call `value` in an error message. */
function describe(value: unknown): string {
    if (value === undefined) return "undefined"
    if (typeof value === "function") return "A function"
    if (typeof value === "object" && value !== null) return `A ${value.constructor?.name ?? "value"}`
    return `The value ${String(value)}`
}
