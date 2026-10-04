import { NixtyError } from "../errors.js"
import type { EmitContext, Node } from "./node.js"

/**
 * A path written in the code: `./src`, `./.`, `/etc/hosts`. A relative path is relative to the
 * generated `flake.nix`.
 *
 * The path is normalised when the node is made: `"src/"` becomes `./src` and `"."` becomes `./.`.
 */
export class PathLiteral implements Node {
    readonly path: string
    readonly compound = false
    readonly suggestedName = null
    readonly system = null

    constructor(path: string) {
        this.path = normalize(path)
    }

    emit(_ctx: EmitContext): string {
        return this.path
    }

    children(): Node[] {
        return []
    }
}

function normalize(path: string): string {
    if (path === "") throw new NixtyError("A path can't be empty; use \".\" for the project folder.")
    // Nix rejects `a//b` and a trailing `/`.
    let p = path.replace(/\/+/g, "/")
    if (p !== "/") p = p.replace(/\/$/, "")
    // `.`, `..` and `/` alone aren't path literals; `./.`, `../.` and `/.` are.
    if (p === "/") p = "/."
    if (p === "." || p === "..") p += "/."
    if (!p.startsWith("/") && !p.startsWith("./") && !p.startsWith("../")) p = "./" + p
    if (!/^[a-zA-Z0-9._\-+/]+$/.test(p))
        throw new NixtyError(`"${path}" can't be written as a Nix path: use only letters, digits and . _ - + /`)
    return p
}
