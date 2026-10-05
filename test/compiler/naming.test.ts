import { describe, expect, it } from "vitest"
import { Call } from "../../src/compiler/ast/call.js"
import { Input } from "../../src/compiler/ast/input.js"
import { List } from "../../src/compiler/ast/list.js"
import type { Node } from "../../src/compiler/ast/node.js"
import { Select } from "../../src/compiler/ast/select.js"
import { Var } from "../../src/compiler/ast/var.js"
import { System } from "../../src/compiler/constants.js"
import type { SystemGraph } from "../../src/compiler/phases/expand.js"
import { chooseNames } from "../../src/compiler/phases/naming.js"
import { walk } from "../../src/compiler/phases/walk.js"

const X86 = System.x86_64Linux

function graph(system: System, ...nodes: Node[]): SystemGraph {
    return { system, outputs: nodes.map((node, i) => ({ category: "packages", name: `p${i}`, node })) }
}

describe("naming", () => {
    it("names inputs, resolving clashes and reserved names", () => {
        const a = new Input("github:NixOS/nixpkgs/a", "nixpkgs")
        const b = new Input("github:NixOS/nixpkgs/b", "nixpkgs")
        const self = new Input("github:me/self", "self")
        const odd = new Input("github:me/2fa tool", "2fa tool")
        const { inputs } = chooseNames(walk([graph(X86, new List([a, b, self, odd]))]))
        expect([...inputs.values()]).toEqual(["nixpkgs", "nixpkgs_2", "self_2", "fa-tool"])
    })

    it("binds shared nodes that suggest a name, and shared calls", () => {
        const nixpkgs = new Input("github:NixOS/nixpkgs", "nixpkgs")
        const pkgs = new Call(new Var("import"), [nixpkgs], { suggestedName: "nixpkgs" })
        const file = new Call(new Select(pkgs, ["writeText"]), [new Var("null")])
        const go = new Select(pkgs, ["go"])
        const gopls = new Select(pkgs, ["gopls"], { suggestedName: "let" })
        const { lets } = chooseNames(walk([graph(X86, new List([pkgs, file, file, go, go, gopls, gopls, nixpkgs]))]))
        // `nixpkgs` is the input's name, `let` a keyword; a Select without a name stays in place.
        expect([...lets.get(X86)!.entries()]).toEqual([
            [pkgs, "nixpkgs_2"],
            [file, "writeText"],
            [gopls, "let_"],
        ])
    })
})
