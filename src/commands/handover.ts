// A `nixty` run on a project with its own copy of nixty-lib hands the command over to that copy.
//
// The user's nixty.ts imports nixty-lib from the project's node_modules, so its objects are made by
// that copy's classes. A compiler from another copy (e.g. a global install) can't read them: to it they
// aren't `instanceof Definition`, and JavaScript only lets a class read the `#` fields of objects it
// made. Handing over makes the library and the compiler always the same copy, whichever `nixty` the
// user typed.
import { existsSync, readFileSync, realpathSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { runInForeground } from "./foreground.js"

/** Set for the copy a command was handed over to, so it never hands it over again. */
const HANDED_OVER = "NIXTY_HANDED_OVER"

/**
 * The CLI of the project's own copy of nixty-lib, or `null` when the copy running is that one, or there
 * is none. The copy is looked for like Node looks for the user's import: in `node_modules`, from
 * `fromDir` up, the nearest one wins.
 */
export function localCli(fromDir: string): string | null {
    if (process.env[HANDED_OVER] !== undefined) return null
    for (let dir = fromDir; ; dir = dirname(dir)) {
        const copy = join(dir, "node_modules", "nixty-lib")
        if (existsSync(join(copy, "package.json"))) {
            const root = realpathSync(copy)
            return root === ownRoot() ? null : cliOf(root)
        }
        if (dirname(dir) === dir) return null
    }
}

/** Runs the same command with `cli`, in this terminal, and resolves with its exit code. */
export function handOver(cli: string, argv: string[]): Promise<number> {
    return runInForeground(process.execPath, [cli, ...argv], { ...process.env, [HANDED_OVER]: "1" })
}

/** The folder of the copy running: two up from both src/commands/ and dist/commands/. */
function ownRoot(): string {
    return realpathSync(join(dirname(fileURLToPath(import.meta.url)), "..", ".."))
}

/** The `nixty` binary a copy declares in its package.json, or `null` if it has none. */
function cliOf(root: string): string | null {
    const { bin } = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
        bin?: string | Record<string, string>
    }
    const path = typeof bin === "string" ? bin : bin?.["nixty"]
    if (path === undefined) return null
    const cli = resolve(root, path)
    return existsSync(cli) ? cli : null
}
