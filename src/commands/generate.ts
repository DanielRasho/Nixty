// `nixty generate`: nixty.ts -> flake.nix.
import { spawnSync } from "node:child_process"
import { basename, dirname, join, relative, resolve } from "node:path"
import { generate } from "../compiler/compiler.js"

export interface GenerateCommandOptions {
    /** Where to write; `flake.nix` next to the file by default. `-` prints it instead. */
    out?: string | undefined
    /** `false` skips the type-check (`--no-typecheck`). */
    typecheck: boolean
}

/** Compiles `file` and writes the flake. Returns the exit code. */
export async function generateCommand(file: string, options: GenerateCommandOptions): Promise<number> {
    if (options.out === "-") {
        process.stdout.write(await generate({ file, out: "", typecheck: options.typecheck }))
        return 0
    }
    const out = options.out ?? join(dirname(file), "flake.nix")
    await generate({ file, out, typecheck: options.typecheck })
    // Messages go to stderr, so stdout stays clean for the commands that print the flake or run nix.
    console.error(`nixty: wrote ${shown(out)}`)
    warnIfUntracked(out)
    return 0
}

/**
 * In a git repository Nix only sees the files git tracks, so a new flake.nix is invisible to it until
 * it's added. Says so, rather than leaving the user with Nix's error.
 */
export function warnIfUntracked(file: string): void {
    const dir = dirname(resolve(file))
    const inRepo = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: dir, encoding: "utf8" })
    // Also covers git not being installed (no status).
    if (inRepo.status !== 0 || inRepo.stdout.trim() !== "true") return
    const tracked = spawnSync("git", ["ls-files", "--error-unmatch", basename(file)], { cwd: dir })
    if (tracked.status !== 0) {
        const name = shown(file)
        console.error(`nixty: ${name} isn't tracked by git, and Nix ignores untracked files. Run: git add ${name}`)
    }
}

/** `path` as the user would type it: relative to the current folder when it's inside it. */
function shown(path: string): string {
    const rel = relative(process.cwd(), path)
    return rel === "" || rel.startsWith("..") ? resolve(path) : rel
}
