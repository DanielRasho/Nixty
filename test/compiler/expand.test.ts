import { describe, expect, it } from "vitest"
import { Call } from "../../src/compiler/ast/call.js"
import { Input } from "../../src/compiler/ast/input.js"
import { Select } from "../../src/compiler/ast/select.js"
import { Command } from "../../src/compiler/api/command.js"
import { Definition } from "../../src/compiler/api/definition.js"
import { DevShell } from "../../src/compiler/api/devShell.js"
import { Flake, Nixpkgs } from "../../src/compiler/api/helpers.js"
import { Package } from "../../src/compiler/api/package.js"
import { Derivation, Expresion, Path, Source, nix, type DerivationDefinition } from "../../src/compiler/api/primitives.js"
import { System } from "../../src/compiler/constants.js"
import { NixtyError } from "../../src/compiler/errors.js"
import { expand } from "../../src/compiler/phases/expand.js"
import { ExpandContext } from "../../src/compiler/phases/expand/context.js"
import { valueNode } from "../../src/compiler/phases/expand/values.js"
import { emitNamed } from "../helpers.js"

const X86 = System.x86_64Linux
const ARM = System.aarch64Linux
const NIX_PKGS = new Nixpkgs({ tag: "nixos-25.05" })
const src = new Source(Path.fetchInternalPath("."))

function context(): ExpandContext {
    return new ExpandContext(X86, NIX_PKGS, new Map())
}

function pkg(name: string, systems: System[], definition: (system: System) => Partial<DerivationDefinition>): Package {
    return new Package({
        name,
        systems,
        definition: (system) => ({
            version: "1.0",
            src,
            deps: {},
            phases: () => ({}),
            ...definition(system),
        }),
    })
}

describe("values", () => {
    it("writes plain JS values as literals", () => {
        const node = valueNode(context(), { a: [1, -2, "x"], b: true, c: null, skipped: undefined } as never)
        expect(emitNamed(node)).toBe('{\n  a = [ 1 (-2) "x" ];\n  b = true;\n  c = null;\n}')
    })

    it("rejects values Nix can't hold", () => {
        expect(() => valueNode(context(), new Map() as never)).toThrow(/A Map can't be written in Nix/)
    })

    it("writes nix strings with their values inside, numbers as text", () => {
        const [go] = NIX_PKGS.getPackages(["go"], X86)
        const node = valueNode(context(), nix`${go}/bin/go version ${2}`)
        expect(emitNamed(node)).toContain('.go}/bin/go version 2"')
    })
})

describe("paths", () => {
    it("writes project paths as path literals", () => {
        const ctx = context()
        expect(emitNamed(valueNode(ctx, Path.fetchInternalPath(".")))).toBe("./.")
        expect(emitNamed(valueNode(ctx, Path.fetchInternalPath("src").subPath("lib/")))).toBe("./src/lib")
    })

    it("writes fetched paths as inputs, one per URL", () => {
        const ctx = context()
        const a = valueNode(ctx, Path.fetchFromGithub({ owner: "me", repo: "tools", tag: "v1" }))
        const b = valueNode(ctx, Path.fetchFromGithub({ owner: "me", repo: "tools", tag: "v1" }))
        expect(a).toBeInstanceOf(Input)
        expect(a).toBe(b)
        expect((a as Input).url).toBe("github:me/tools/v1")
    })

    it("writes a path inside a fetched one as a string", () => {
        const tools = Path.fetchFromGithub({ owner: "me", repo: "tools" })
        expect(emitNamed(valueNode(context(), tools.subPath("lib/x.nix")))).toBe('"${tools}/lib/x.nix"')
    })
})

describe("expresions", () => {
    it("writes every kind of step", () => {
        const file = new Expresion(Path.fetchInternalPath("nix/hello.nix"))
        expect(emitNamed(valueNode(context(), file.packages[0].run("now", { fast: true })))).toBe(
            '(builtins.elemAt (import ./nix/hello.nix).packages 0).run "now" {\n  fast = true;\n}',
        )
    })

    it("gives the same node for the same expresion", () => {
        const ctx = context()
        const go = NIX_PKGS.getExpresion("go", X86)
        expect(valueNode(ctx, go)).toBe(valueNode(ctx, NIX_PKGS.getExpresion("go", X86)))
    })

    it("only reads fetched paths as flakes", () => {
        const local = new Flake(Path.fetchInternalPath("sub"))
        expect(() => valueNode(context(), local.getExpresion("lib"))).toThrow(/Only a fetched path can be read as a flake/)
    })
})

describe("derivations", () => {
    it("share one node per package, carrying its name and system", () => {
        const ctx = context()
        const [a] = NIX_PKGS.getPackages(["go"], X86)
        const [b] = NIX_PKGS.getPackages(["go"], X86)
        const node = valueNode(ctx, a)
        expect(valueNode(ctx, b)).toBe(node)
        expect(node.system).toBe(X86)
        expect(node.suggestedName).toBe(null)
        const named = valueNode(ctx, Derivation.fromExpresion(X86, NIX_PKGS.getExpresion("gopls", X86), "gopls"))
        expect(named.suggestedName).toBe("gopls")
    })

    it("share the pkgs root, named pkgs", () => {
        const ctx = context()
        const [go, node] = NIX_PKGS.getPackages(["go", "nodejs"], X86).map((d) => valueNode(ctx, d) as Select)
        expect(go.from).toBe(node.from)
        expect(go.from).toBeInstanceOf(Call)
        expect(go.from.suggestedName).toBe("pkgs")
    })
})

describe("outputs", () => {
    it("are expanded for every system they support", () => {
        const p = pkg("p", [X86, ARM], () => ({}))
        const shell = new DevShell({ name: "s", systems: [ARM], packages: () => [] })
        const graphs = expand(new Definition({ description: "", nixpkgs: NIX_PKGS, packages: [p], devShells: [shell] }))
        expect(graphs.map((g) => [g.system, g.outputs.map((o) => `${o.category}.${o.name}`)])).toEqual([
            [X86, ["packages.p"]],
            [ARM, ["packages.p", "devShells.s"]],
        ])
    })

    it("make a package the same node wherever it's used", () => {
        const p = pkg("p", [X86], () => ({}))
        const shell = new DevShell({ name: "s", systems: [X86], packages: (system) => [p.getDerivation(system)] })
        const [graph] = expand(new Definition({ description: "", nixpkgs: NIX_PKGS, packages: [p], devShells: [shell] }))
        const shellArgs = (graph.outputs[1].node as Call).args[0]
        expect(shellArgs.children()[1].children()).toContain(graph.outputs[0].node)
        expect(graph.outputs[0].node.suggestedName).toBe("p")
    })

    it("skip missing phases and keep the standard ones", () => {
        const p = pkg("p", [X86], () => ({ phases: () => ({ build: nix`make` }) }))
        const [graph] = expand(new Definition({ description: "", nixpkgs: NIX_PKGS, packages: [p] }))
        const code = emitNamed(graph.outputs[0].node)
        expect(code).toContain("dontConfigure = true;")
        expect(code).toContain('buildPhase = "make";')
        expect(code).toContain("dontInstall = true;")
        expect(code).not.toContain("doCheck")
    })

    it("write commands as apps", () => {
        const command = new Command({ name: "hi", systems: [X86], packages: () => [], env: { A: "1" }, command: "echo hi" })
        const [graph] = expand(new Definition({ description: "", nixpkgs: NIX_PKGS, commands: [command] }))
        expect(emitNamed(graph.outputs[0].node)).toContain("export A=${")
    })

    it("reject environment names a shell can't export", () => {
        const command = new Command({ name: "hi", systems: [X86], packages: () => [], env: { "A-B": "1" }, command: "x" })
        const definition = new Definition({ description: "", nixpkgs: NIX_PKGS, commands: [command] })
        expect(() => expand(definition)).toThrow(/"A-B" can't be an environment variable name/)
    })

    it("say which output and system a recipe failed in", () => {
        const p = new Package({
            name: "p",
            systems: [ARM],
            definition: () => {
                throw new Error("boom")
            },
        })
        const definition = new Definition({ description: "", nixpkgs: NIX_PKGS, packages: [p] })
        expect(() => expand(definition)).toThrow(NixtyError)
        expect(() => expand(definition)).toThrow("packages.p (aarch64-linux): boom")
    })

    it("reject two outputs with the same name", () => {
        const p = pkg("p", [X86], () => ({}))
        const definition = new Definition({ description: "", nixpkgs: NIX_PKGS, packages: [p, p] })
        expect(() => expand(definition)).toThrow(/Two packages are named "p"/)
    })
})
