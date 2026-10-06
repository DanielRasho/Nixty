// `nixty init`: writes a nixty.ts to start from, a copy of src/template.ts.
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { NixtyError } from "../compiler/errors.js"

/** src/template.ts, or dist/template.ts once built: `pnpm build` copies it there as it is. */
const TEMPLATE = new URL("../template.ts", import.meta.url)

/** Writes the template to `dir`/nixty.ts, unless there is one already. Returns the exit code. */
export function initCommand(dir: string): number {
    try {
        // "wx" fails if the file exists, so an existing nixty.ts is never overwritten.
        writeFileSync(join(dir, "nixty.ts"), readFileSync(TEMPLATE, "utf8"), { flag: "wx" })
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST")
            throw new NixtyError("nixty.ts already exists in this folder; nothing was written.")
        throw error
    }
    console.error("nixty: wrote nixty.ts")
    return 0
}
