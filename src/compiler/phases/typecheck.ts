// Phase "type-check": run the bundled `tsc` on the user's file before it runs. TypeScript 7 has no
// stable in-process compiler API, so it runs as a child process.
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, parse, resolve } from "node:path"

export interface TypecheckResult {
    ok: boolean
    /** tsc's errors, ready to print. Empty when `ok`. */
    output: string
}

/**
 * Type-checks `file` and what it imports, never the rest of the user's project. The user's nearest
 * tsconfig.json is extended, so their own settings (strictness, paths) apply.
 *
 * The config is written to `node_modules/.cache/nixty/` in the user's project, so module resolution
 * (`nixty-lib`, `@types`) starts from there.
 */
export function checkTypes(file: string): TypecheckResult {
    const entry = resolve(file)
    const projectDir = findUp(dirname(entry), "package.json") ?? dirname(entry)
    const userConfig = findUp(dirname(entry), "tsconfig.json")

    const config = {
        ...(userConfig === null ? {} : { extends: join(userConfig, "tsconfig.json") }),
        compilerOptions: {
            // Without a tsconfig of the user's, the settings nixty-lib is written for.
            ...(userConfig === null ? { strict: true, module: "nodenext", target: "esnext", skipLibCheck: true } : {}),
            noEmit: true,
            // Node runs the file without a build step, so its local imports end in `.ts`.
            allowImportingTsExtensions: true,
            // With it on, every `expr.a.b` through an `Expresion` types as `Expresion | undefined`.
            noUncheckedIndexedAccess: false,
            // TypeScript defaults rootDir to this config's folder, which doesn't contain the user's files.
            rootDir: parse(entry).root,
        },
        files: [entry],
        include: [],
    }

    const configDir = join(projectDir, "node_modules", ".cache", "nixty")
    mkdirSync(configDir, { recursive: true })
    const configPath = join(configDir, "tsconfig.json")
    writeFileSync(configPath, JSON.stringify(config, null, 2))

    const result = spawnSync(process.execPath, [tscPath(), "--project", configPath, "--pretty", "false"], {
        encoding: "utf8",
    })
    if (result.error !== undefined) throw result.error
    return { ok: result.status === 0, output: `${result.stdout}${result.stderr}`.trim() }
}

/** The `tsc` of the `typescript` nixty-lib depends on, not the user's own. */
function tscPath(): string {
    const typescript = dirname(createRequire(import.meta.url).resolve("typescript/package.json"))
    return join(typescript, "bin", "tsc")
}

/** The closest folder holding `name`, starting at `dir` and going up; `null` if there's none. */
export function findUp(dir: string, name: string): string | null {
    for (let current = dir; ; current = dirname(current)) {
        if (existsSync(join(current, name))) return current
        if (dirname(current) === current) return null
    }
}
