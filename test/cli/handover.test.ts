import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { main } from "../../src/cli.js"
import { runInForeground } from "../../src/commands/foreground.js"
import { handOver, localCli } from "../../src/commands/handover.js"

const REPO = join(import.meta.dirname, "..", "..")

/**
 * A project whose node_modules has a copy of nixty-lib with its CLI at `bin`. That CLI writes the
 * arguments it got, and whether it was handed the command, to `<project>/got`, then exits with 7.
 */
function projectWithCopy(bin = "./dist/cli.js"): { project: string; cli: string } {
    const project = mkdtempSync(join(tmpdir(), "nixty-handover-"))
    const copy = join(project, "node_modules", "nixty-lib")
    mkdirSync(join(copy, "dist"), { recursive: true })
    writeFileSync(join(copy, "package.json"), JSON.stringify({ name: "nixty-lib", bin: { nixty: bin } }))
    const got = JSON.stringify(join(project, "got"))
    writeFileSync(
        join(copy, "dist", "cli.js"),
        `require("fs").writeFileSync(${got}, JSON.stringify({ argv: process.argv.slice(2), handedOver: process.env.NIXTY_HANDED_OVER }))\n` +
            "process.exit(7)\n",
    )
    return { project, cli: join(copy, "dist", "cli.js") }
}

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
})

describe("localCli", () => {
    it("finds the project's copy from the project or a folder inside it", () => {
        const { project, cli } = projectWithCopy()
        mkdirSync(join(project, "src", "deep"), { recursive: true })
        expect(localCli(project)).toBe(cli)
        expect(localCli(join(project, "src", "deep"))).toBe(cli)
    })

    it("is null when the project's copy is the one running", () => {
        const project = mkdtempSync(join(tmpdir(), "nixty-handover-"))
        mkdirSync(join(project, "node_modules"))
        // How `pnpm add link:<repo>` installs it.
        symlinkSync(REPO, join(project, "node_modules", "nixty-lib"))
        expect(localCli(project)).toBe(null)
    })

    it("is null without a copy, or one without a nixty binary", () => {
        expect(localCli(mkdtempSync(join(tmpdir(), "nixty-handover-")))).toBe(null)
        expect(localCli(projectWithCopy("./dist/missing.js").project)).toBe(null)
    })

    it("is null once a command has been handed over", () => {
        vi.stubEnv("NIXTY_HANDED_OVER", "1")
        expect(localCli(projectWithCopy().project)).toBe(null)
    })
})

describe("handOver", () => {
    it("runs the same arguments with the other copy, marked as handed over", async () => {
        const { project, cli } = projectWithCopy()
        expect(await handOver(cli, ["build", "app", "-L"])).toBe(7)
        expect(JSON.parse(readFileSync(join(project, "got"), "utf8"))).toEqual({
            argv: ["build", "app", "-L"],
            handedOver: "1",
        })
    })

    it("happens before parsing, so even options this copy doesn't know reach it", async () => {
        const { project } = projectWithCopy()
        vi.spyOn(process, "cwd").mockReturnValue(project)
        expect(await main(["future-command", "--future-option"])).toBe(7)
        expect(JSON.parse(readFileSync(join(project, "got"), "utf8")).argv).toEqual(["future-command", "--future-option"])
    })
})

describe("runInForeground", () => {
    it("ignores Ctrl+C here while the child runs, and stops after", async () => {
        const before = process.listenerCount("SIGINT")
        const running = runInForeground(process.execPath, ["-e", "setTimeout(() => {}, 50)"])
        expect(process.listenerCount("SIGINT")).toBe(before + 1)
        expect(await running).toBe(0)
        expect(process.listenerCount("SIGINT")).toBe(before)
    })

    it("gives 128 + the signal's number when the child is killed by one", async () => {
        expect(await runInForeground(process.execPath, ["-e", "process.kill(process.pid, 'SIGTERM')"])).toBe(143)
    })
})
