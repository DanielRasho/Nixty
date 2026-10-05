import { spawnSync } from "node:child_process"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { compile } from "nixty-lib/compiler"
import { main } from "../../src/cli.js"
import { currentSystem, nixArgs } from "../../src/commands/nix.js"
import { System } from "../../src/compiler/constants.js"
import compile01 from "../cases/compile01.js"

const COMPILE01 = join(import.meta.dirname, "..", "cases", "compile01.ts")
const REPO = join(import.meta.dirname, "..", "..")
const FEATURES = ["--extra-experimental-features", "nix-command flakes"]

function tempDir(): string {
    return mkdtempSync(join(tmpdir(), "nixty-cli-"))
}

afterEach(() => {
    vi.restoreAllMocks()
})

describe("nixty generate", () => {
    it("writes the flake next to the file, or to --out", async () => {
        const out = join(tempDir(), "flake.nix")
        expect(await main(["generate", COMPILE01, "--out", out])).toBe(0)
        expect(readFileSync(out, "utf8")).toBe(compile(compile01))
    })

    it("prints the flake with --out -", async () => {
        const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true)
        expect(await main(["generate", COMPILE01, "--out", "-", "--no-typecheck"])).toBe(0)
        expect(write).toHaveBeenCalledWith(compile(compile01))
    })

    it("reports type errors and writes nothing", async () => {
        const dir = tempDir()
        writeFileSync(join(dir, "nixty.ts"), "const x: string = 1\nexport default x\n")
        const error = vi.spyOn(console, "error").mockImplementation(() => {})
        expect(await main(["generate", join(dir, "nixty.ts")])).toBe(1)
        expect(error.mock.calls[0][0]).toMatch(/^nixty: .*nixty\.ts has type errors:\n.*TS2322/s)
        expect(existsSync(join(dir, "flake.nix"))).toBe(false)
    })

    it.skipIf(spawnSync("git", ["--version"]).status !== 0)("warns when git doesn't track flake.nix", async () => {
        const dir = tempDir()
        spawnSync("git", ["init", "-q"], { cwd: dir })
        const error = vi.spyOn(console, "error").mockImplementation(() => {})
        expect(await main(["generate", COMPILE01, "--out", join(dir, "flake.nix"), "--no-typecheck"])).toBe(0)
        expect(error.mock.calls.map((call) => call[0]).join("\n")).toMatch(/isn't tracked by git.*git add/)
    })
})

describe("commands handing off to nix", () => {
    it("pick outputs by their full path", () => {
        const x86 = System.x86_64Linux
        expect(nixArgs("build", ".", x86, ["WeatherCLI", "-L"])).toEqual([
            ...FEATURES, "build", ".#packages.x86_64-linux.WeatherCLI", "-L",
        ])
        expect(nixArgs("run", ".", x86, ["WeatherCLI", "--help"])).toEqual([
            ...FEATURES, "run", ".#packages.x86_64-linux.WeatherCLI", "--", "--help",
        ])
        expect(nixArgs("command", ".", x86, ["test"])).toEqual([...FEATURES, "run", ".#apps.x86_64-linux.test", "--"])
        expect(nixArgs("develop", "/p", x86, ["dev"])).toEqual([...FEATURES, "develop", "/p#devShells.x86_64-linux.dev"])
        expect(nixArgs("update", ".", x86, ["nixpkgs"])).toEqual([...FEATURES, "flake", "update", "--flake", ".", "nixpkgs"])
        // Names that aren't plain Nix names are quoted.
        expect(nixArgs("build", ".", x86, ["my.app"])[3]).toBe('.#packages.x86_64-linux."my.app"')
    })

    it("want the name before nix's options", () => {
        expect(() => nixArgs("build", ".", System.x86_64Linux, ["-L", "WeatherCLI"])).toThrow(/Write the name first/)
    })

    it("regenerate the flake of the nixty.ts above, then run nix", async () => {
        // A project whose nixty.ts is compile01, and a fake nix that records its arguments.
        const root = tempDir()
        const project = join(root, "project")
        mkdirSync(join(project, "sub"), { recursive: true })
        // The repo's settings (for its `nixty-lib` paths), without @types/node, which /tmp can't reach.
        const tsconfig = { extends: join(REPO, "tsconfig.json"), compilerOptions: { types: [] } }
        writeFileSync(join(project, "tsconfig.json"), JSON.stringify(tsconfig))
        writeFileSync(join(project, "package.json"), JSON.stringify({ type: "module" }))
        writeFileSync(join(project, "nixty.ts"), `export { default } from ${JSON.stringify(COMPILE01)}\n`)
        mkdirSync(join(root, "bin"))
        writeFileSync(join(root, "bin", "nix"), `#!/bin/sh\nprintf '%s\\n' "$@" > "${join(root, "args")}"\nexit 3\n`)
        chmodSync(join(root, "bin", "nix"), 0o755)

        vi.spyOn(process, "cwd").mockReturnValue(join(project, "sub"))
        vi.stubEnv("PATH", `${join(root, "bin")}:${process.env["PATH"]}`)
        try {
            expect(await main(["build", "WeatherCLI", "-L"])).toBe(3)
        } finally {
            vi.unstubAllEnvs()
        }
        expect(readFileSync(join(project, "flake.nix"), "utf8")).toBe(compile(compile01))
        expect(readFileSync(join(root, "args"), "utf8").trim().split("\n")).toEqual([
            ...FEATURES, "build", `${project}#packages.${currentSystem()}.WeatherCLI`, "-L",
        ])
    })

    it("need a nixty.ts", async () => {
        vi.spyOn(process, "cwd").mockReturnValue(tempDir())
        const error = vi.spyOn(console, "error").mockImplementation(() => {})
        expect(await main(["develop", "dev"])).toBe(1)
        expect(error).toHaveBeenCalledWith(expect.stringMatching(/No nixty\.ts in this folder or any above it/))
    })
})

describe("the program", () => {
    it("fails on an unknown command or a missing name", async () => {
        vi.spyOn(process.stderr, "write").mockImplementation(() => true)
        expect(await main(["bogus"])).toBe(1)
        expect(await main(["build"])).toBe(1)
    })

    it("shows help and the version", async () => {
        const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true)
        expect(await main(["--help"])).toBe(0)
        expect(write.mock.calls.map((call) => call[0]).join("")).toMatch(/nixty develop dev/)
        expect(await main(["--version"])).toBe(0)
    })
})
