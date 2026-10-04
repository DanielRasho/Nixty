// Helpers the nodes share to write Nix code.

const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_'-]*$/
const KEYWORDS = new Set(["if", "then", "else", "assert", "with", "let", "in", "rec", "inherit", "or"])

/** Whether `name` can be written bare, as a variable or an attribute name. */
export function isIdentifier(name: string): boolean {
    return IDENTIFIER.test(name) && !KEYWORDS.has(name)
}

/** An attribute name, quoted only when it has to be: `a`, `x86_64-linux`, `"a b"`, `"let"`. */
export function attrName(name: string): string {
    return isIdentifier(name) ? name : `"${escapeQuoted(name)}"`
}

/** `text` escaped to go between the quotes of a `"..."` string. */
export function escapeQuoted(text: string): string {
    return text
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\$\{/g, "\\${")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t")
}

/**
 * Indents every line but the first by two spaces, to place a child's code inside a block. Empty lines
 * stay empty. `Str` relies on this moving all its other lines together.
 */
export function indent(code: string): string {
    return code
        .split("\n")
        .map((line, i) => (i === 0 || line === "" ? line : "  " + line))
        .join("\n")
}
