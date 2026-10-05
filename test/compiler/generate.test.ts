import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { NixtyError } from "nixty-lib"
import { compile, generate } from "nixty-lib/compiler"
import { checkTypes } from "../../src/compiler/phases/typecheck.js"
import compile01 from "../cases/compile01.js"

const COMPILE01 = join(import.meta.dirname, "..", "cases", "compile01.ts")

/** A file named `name` with `code`, in a new folder outside the project. */
function tempFile(name: string, code: string): string {
    const file = join(mkdtempSync(join(tmpdir(), "nixty-gen-")), name)
    writeFileSync(file, code)
    return file
}

describe("checkTypes", () => {
    it("reports type errors in the user's file", () => {
        const result = checkTypes(tempFile("nixty.ts", "const x: string = 1\nexport default x\n"))
        expect(result.ok).toBe(false)
        expect(result.output).toMatch(/TS2322/)
    })

    it("accepts compile01", () => {
        expect(checkTypes(COMPILE01)).toEqual({ ok: true, output: "" })
    })
})

describe("generate", () => {
    it("writes the compiled flake to out", async () => {
        const out = join(mkdtempSync(join(tmpdir(), "nixty-gen-")), "flake.nix")
        const text = await generate({ file: COMPILE01, out })
        expect(text).toBe(compile(compile01))
        expect(readFileSync(out, "utf8")).toBe(text)
    })

    it("writes nothing when out is empty", async () => {
        expect(await generate({ file: COMPILE01, out: "", typecheck: false })).toBe(compile(compile01))
    })

    it("stops on type errors", async () => {
        const file = tempFile("nixty.ts", "const x: string = 1\nexport default x\n")
        await expect(generate({ file, out: "" })).rejects.toThrow(NixtyError)
        await expect(generate({ file, out: "" })).rejects.toThrow(/has type errors:\n.*TS2322/)
    })

    it("needs a Definition as the default export", async () => {
        const file = tempFile("nixty.ts", "export default 1\n")
        await expect(generate({ file, out: "", typecheck: false })).rejects.toThrow(/must end with `export default new Definition/)
    })

    it("needs the file to exist", async () => {
        await expect(generate({ file: "missing.ts" })).rejects.toThrow(/missing\.ts not found/)
    })
})
