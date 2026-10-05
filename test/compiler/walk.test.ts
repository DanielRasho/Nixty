import { describe, expect, it } from "vitest"
import { Call } from "../../src/compiler/ast/call.js"
import { FlakeOutputs } from "../../src/compiler/ast/flakeOutputs.js"
import { Input } from "../../src/compiler/ast/input.js"
import { List } from "../../src/compiler/ast/list.js"
import type { Node } from "../../src/compiler/ast/node.js"
import { Select } from "../../src/compiler/ast/select.js"
import { Var } from "../../src/compiler/ast/var.js"
import { System } from "../../src/compiler/constants.js"
import { NixtyError } from "../../src/compiler/errors.js"
import type { SystemGraph } from "../../src/compiler/phases/expand.js"
import { walk } from "../../src/compiler/phases/walk.js"

const X86 = System.x86_64Linux
const ARM = System.aarch64Linux

function graph(system: System, ...nodes: Node[]): SystemGraph {
    return { system, outputs: nodes.map((node, i) => ({ category: "packages", name: `p${i}`, node })) }
}

describe("walk", () => {
    const nixpkgs = new Input("github:NixOS/nixpkgs", "nixpkgs")
    const pkgs = new Call(new Var("import"), [nixpkgs], { suggestedName: "pkgs" })
    const go = new Select(pkgs, ["go"])

    it("counts how often each node is reached, visiting children once", () => {
        const [facts] = walk([graph(X86, new List([go, go]), go)]).systems
        expect(facts.uses.get(go)).toBe(3)
        expect(facts.uses.get(pkgs)).toBe(1)
        expect(facts.order.indexOf(pkgs)).toBeLessThan(facts.order.indexOf(go))
    })

    it("collects the inputs reached, and which are read as flakes", () => {
        const tools = new Input("github:me/tools", "tools")
        new Input("github:me/unused", "unused")
        const result = walk([graph(X86, go, new Select(new FlakeOutputs(tools), ["packages"]))])
        expect(result.inputs).toEqual([nixpkgs, tools])
        expect([...result.flakeInputs]).toEqual([tools])
    })

    it("rejects a node from another system", () => {
        const x86Go = new Select(pkgs, ["go"], { system: X86 })
        expect(() => walk([graph(X86, x86Go), graph(ARM, x86Go)])).toThrow(NixtyError)
        expect(() => walk([graph(ARM, x86Go)])).toThrow(/packages\.p0 \(aarch64-linux\) uses a value made for x86_64-linux/)
    })
})
