import { escapeQuoted } from "./format.js"
import type { EmitContext, Node } from "./node.js"

/**
 * A string, which may have values inside: `"npm ${pkgs.go}/bin build"`.
 *
 * It's made of pieces, text and nodes in order: `new Str(["npm ", go, "/bin build"])`. A piece that
 * is another `Str` is spliced in rather than nested as `${"..."}`.
 *
 * Text with a newline is written as an indented string (`''...''`) when Nix reads it back unchanged.
 * Nix strips the indentation shared by all lines of one and drops a last line made of spaces, so
 * text where that would happen is written as `"..."` with `\n` instead.
 */
export class Str implements Node {
    /** Text and nodes in order. Never two texts in a row, nor an empty text. */
    readonly pieces: (string | Node)[]
    readonly compound = false
    readonly suggestedName = null
    readonly system = null

    constructor(pieces: (string | Node)[]) {
        this.pieces = []
        for (const piece of pieces.flatMap((p) => (p instanceof Str ? p.pieces : [p]))) {
            if (piece === "") continue
            const last = this.pieces[this.pieces.length - 1]
            if (typeof piece === "string" && typeof last === "string")
                this.pieces[this.pieces.length - 1] = last + piece
            else
                this.pieces.push(piece)
        }
    }

    emit(ctx: EmitContext): string {
        return fitsIndented(this.pieces) ? indented(this.pieces, ctx) : quoted(this.pieces, ctx)
    }

    children(): Node[] {
        const nodes: Node[] = []
        for (const piece of this.pieces) {
            if (typeof piece !== "string") nodes.push(piece)
        }
        return nodes
    }
}

/**
 * Whether `''...''` keeps the text unchanged: it has more than one line, some line starts without a
 * space (so there's no shared indentation to strip), and the last line isn't only spaces.
 */
function fitsIndented(pieces: (string | Node)[]): boolean {
    // A value counts as one character that isn't a space.
    const lines = pieces.map((p) => (typeof p === "string" ? p : "x")).join("").split("\n")
    if (lines.length === 1) return false
    if (/^ +$/.test(lines[lines.length - 1])) return false
    return lines.some((line) => line !== "" && !line.startsWith(" "))
}

function quoted(pieces: (string | Node)[], ctx: EmitContext): string {
    let code = ""
    for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i]
        if (typeof piece !== "string") {
            code += "${" + ctx.emit(piece) + "}"
            continue
        }
        let text = escapeQuoted(piece)
        // `$${` is plain text in Nix, not `$` and then a value, so a `$` right before a value is escaped.
        if (i + 1 < pieces.length && text.endsWith("$")) text = text.slice(0, -1) + "\\$"
        code += text
    }
    return `"${code}"`
}

/**
 * `''...''` with the text on its own lines, one level in. Nix strips that indentation, and the one
 * parents add to every line (`indent`), so neither is part of the text.
 */
function indented(pieces: (string | Node)[], ctx: EmitContext): string {
    // Written as tokens first, so each `'` can see what comes after it.
    const tokens: string[] = []
    for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i]
        if (typeof piece !== "string") {
            tokens.push("${" + ctx.emit(piece) + "}")
            continue
        }
        const beforeValue = i + 1 < pieces.length
        for (let j = 0; j < piece.length; j++) {
            // `${` would start a value and `$${` would hide the value after it, so that `$` is escaped.
            const dollarEscaped = piece[j] === "$" && (piece[j + 1] === "{" || (beforeValue && j + 1 === piece.length))
            tokens.push(dollarEscaped ? "''$" : piece[j])
        }
    }
    tokens.push("''")
    // A `'` followed by another would be read as part of an escape or of the closing `''`, so it is
    // escaped too (`''\'`). Going right to left, each `'` sees the next one already escaped.
    for (let k = tokens.length - 2; k >= 0; k--) {
        if (tokens[k] === "'" && tokens[k + 1].startsWith("'")) tokens[k] = "''\\'"
    }
    tokens.pop()
    const lines = tokens.join("").split("\n").map((line) => (line === "" ? line : "  " + line))
    return "''\n" + lines.join("\n") + "''"
}
