import { execFileSync, spawnSync } from "node:child_process"
import { describe, expect, it } from "vitest"
import { AttrSet } from "../../src/compiler/ast/attrSet.js"
import { Call } from "../../src/compiler/ast/call.js"
import { FlakeOutputs } from "../../src/compiler/ast/flakeOutputs.js"
import { Input } from "../../src/compiler/ast/input.js"
import { List } from "../../src/compiler/ast/list.js"
import type { Node } from "../../src/compiler/ast/node.js"
import { Num } from "../../src/compiler/ast/num.js"
import { PathLiteral } from "../../src/compiler/ast/pathLiteral.js"
import { Select } from "../../src/compiler/ast/select.js"
import { Str } from "../../src/compiler/ast/str.js"
import { Var } from "../../src/compiler/ast/var.js"
import { System } from "../../src/compiler/constants.js"
import { NixtyError } from "../../src/compiler/errors.js"
import { emit } from "../helpers.js"

const nixpkgs = new Input("github:NixOS/nixpkgs/nixos-25.05", "nixpkgs")
const names = new Map<Node, string>([[nixpkgs, "nixpkgs"]])
const pkgs = new Select(nixpkgs, ["legacyPackages", "x86_64-linux"])
const go = new Select(pkgs, ["go"])

describe("Var", () => {
    it("writes the name", () => {
        expect(emit(new Var("builtins"))).toBe("builtins")
        expect(emit(new Var("true"))).toBe("true")
    })

    it("rejects names Nix can't hold", () => {
        expect(() => new Var("a b")).toThrow()
        expect(() => new Var("let")).toThrow()
    })
})

describe("Num", () => {
    it("writes integers and floats", () => {
        expect(emit(new Num(3))).toBe("3")
        expect(emit(new Num(0.5))).toBe("0.5")
        expect(emit(new Num(1e-7))).toBe("1.0e-7")
        expect(emit(new Num(1e21))).toBe("1.0e+21")
    })

    it("puts negative numbers in parentheses as operands", () => {
        expect(emit(new Num(-1))).toBe("-1")
        expect(emit(new List([new Num(-1), new Num(2)]))).toBe("[ (-1) 2 ]")
    })

    it("rejects NaN and infinities", () => {
        expect(() => new Num(Number.NaN)).toThrow(NixtyError)
        expect(() => new Num(Infinity)).toThrow(NixtyError)
    })
})

describe("PathLiteral", () => {
    it("normalises paths", () => {
        expect(emit(new PathLiteral("."))).toBe("./.")
        expect(emit(new PathLiteral("./"))).toBe("./.")
        expect(emit(new PathLiteral(".."))).toBe("../.")
        expect(emit(new PathLiteral("src/"))).toBe("./src")
        expect(emit(new PathLiteral("./a//b"))).toBe("./a/b")
        expect(emit(new PathLiteral("/opt/x"))).toBe("/opt/x")
        expect(emit(new PathLiteral("/"))).toBe("/.")
    })

    it("rejects paths a literal can't hold", () => {
        expect(() => new PathLiteral("")).toThrow(NixtyError)
        expect(() => new PathLiteral("./has space")).toThrow(NixtyError)
        expect(() => new PathLiteral("~/x")).toThrow(NixtyError)
    })
})

describe("Str", () => {
    it("writes one-line text in double quotes, escaped", () => {
        expect(emit(new Str([]))).toBe('""')
        expect(emit(new Str(['say "hi" \\ ${x} \t']))).toBe('"say \\"hi\\" \\\\ \\${x} \\t"')
    })

    it("writes values as interpolations", () => {
        const str = new Str(["run ", go, " now"])
        expect(emit(str, names)).toBe('"run ${nixpkgs.legacyPackages.x86_64-linux.go} now"')
        expect(str.children()).toEqual([go])
    })

    it("escapes a $ right before a value", () => {
        expect(emit(new Str(["$", go]), names)).toBe('"\\$${nixpkgs.legacyPackages.x86_64-linux.go}"')
    })

    it("splices strings inside it and joins texts", () => {
        const inner = new Str(["in ", go])
        const outer = new Str(["a ", inner, "", " z"])
        expect(outer.pieces).toEqual(["a in ", go, " z"])
    })

    it("writes multi-line text as an indented string starting on its own line", () => {
        expect(emit(new Str(["a\n  b"]))).toBe("''\n  a\n    b''")
        expect(emit(new Str(["a\n"]))).toBe("''\n  a\n''")
        expect(emit(new Str(["it's ${x}\n''"]))).toBe("''\n  it's ''${x}\n  ''\\'''\\'''")
    })

    it("falls back to double quotes when Nix would change an indented string", () => {
        // Every line indented: Nix would strip it.
        expect(emit(new Str(["  a\n  b"]))).toBe('"  a\\n  b"')
        // A last line of spaces: Nix would drop it.
        expect(emit(new Str(["a\n  "]))).toBe('"a\\n  "')
    })
})

describe("List", () => {
    it("writes short lists on one line and long ones one item per line", () => {
        expect(emit(new List([]))).toBe("[ ]")
        expect(emit(new List([new Num(1), new Num(2)]))).toBe("[ 1 2 ]")
        const long = new List([new Str(["a".repeat(30)]), new Str(["b".repeat(30)])])
        expect(emit(long)).toBe(`[\n  "${"a".repeat(30)}"\n  "${"b".repeat(30)}"\n]`)
    })

    it("puts compound items in parentheses", () => {
        const call = new Call(new Select(pkgs, ["f"]), [new Num(1)])
        expect(emit(new List([call]), names)).toBe("[ (nixpkgs.legacyPackages.x86_64-linux.f 1) ]")
    })
})

describe("AttrSet", () => {
    it("writes one attribute per line, quoting names when needed", () => {
        const set = new AttrSet({ a: new Num(1), "b c": new Num(2), let: new Num(3), "x86_64-linux": new Num(4) })
        expect(emit(set)).toBe('{\n  a = 1;\n  "b c" = 2;\n  "let" = 3;\n  x86_64-linux = 4;\n}')
        expect(emit(new AttrSet({}))).toBe("{ }")
    })

    it("indents nested values", () => {
        const set = new AttrSet({ meta: new AttrSet({ text: new Str(["a\nb"]) }) })
        expect(emit(set)).toBe("{\n  meta = {\n    text = ''\n      a\n      b'';\n  };\n}")
    })
})

describe("Select", () => {
    it("writes the attribute path", () => {
        expect(emit(go, names)).toBe("nixpkgs.legacyPackages.x86_64-linux.go")
        expect(emit(new Select(pkgs, ["a b"]), names)).toBe('nixpkgs.legacyPackages.x86_64-linux."a b"')
        expect(go.children()).toEqual([pkgs])
    })

    it("puts a compound base in parentheses", () => {
        const file = new Call(new Var("import"), [new PathLiteral("./hello.nix")])
        expect(emit(new Select(file, ["hello"]))).toBe("(import ./hello.nix).hello")
    })

    it("keeps its suggestedName and system", () => {
        const root = new Select(nixpkgs, ["legacyPackages", "x86_64-linux"], { suggestedName: "pkgs", system: System.x86_64Linux })
        expect(root.suggestedName).toBe("pkgs")
        expect(root.system).toBe(System.x86_64Linux)
        expect(go.suggestedName).toBe(null)
        expect(go.system).toBe(null)
    })
})

describe("Call", () => {
    it("writes the function and its arguments", () => {
        const call = new Call(new Select(pkgs, ["mkShell"]), [new AttrSet({ packages: new List([go]) })])
        expect(emit(call, names)).toBe(
            "nixpkgs.legacyPackages.x86_64-linux.mkShell {\n  packages = [ nixpkgs.legacyPackages.x86_64-linux.go ];\n}",
        )
        expect(call.children()).toEqual([call.fn, call.args[0]])
    })

    it("puts compound arguments in parentheses, but not a call as the function", () => {
        const add = new Select(new Var("builtins"), ["add"])
        const inner = new Call(add, [new Num(1)])
        expect(emit(new Call(inner, [new Num(-2)]))).toBe("builtins.add 1 (-2)")
        expect(emit(new Call(add, [inner]))).toBe("builtins.add (builtins.add 1)")
    })

    it("needs an argument", () => {
        expect(() => new Call(new Var("f"), [])).toThrow(NixtyError)
    })
})

describe("Input and FlakeOutputs", () => {
    it("are written by the name they were given", () => {
        expect(emit(nixpkgs, names)).toBe("nixpkgs")
        expect(emit(new FlakeOutputs(nixpkgs), names)).toBe("nixpkgs")
        expect(new FlakeOutputs(nixpkgs).children()).toEqual([nixpkgs])
    })

    it("fail loudly when the input wasn't named", () => {
        expect(() => emit(nixpkgs)).toThrow()
    })
})

describe("EmitContext", () => {
    it("writes a named node as its name, without parentheses", () => {
        const root = new Call(new Var("import"), [nixpkgs])
        const named = new Map<Node, string>([...names, [root, "pkgs"]])
        expect(emit(new List([root, new Select(root, ["go"])]), named)).toBe("[ pkgs pkgs.go ]")
    })
})

// Checks the written code means what we intend: Nix reads it back to the same values.
const hasNix = spawnSync("nix-instantiate", ["--version"]).status === 0

describe.skipIf(!hasNix)("written code read back by Nix", () => {
    // `{ v = "X"; }.v`: a value that Nix turns into the text "X".
    const X = new Select(new AttrSet({ v: new Str(["X"]) }), ["v"])

    const strings: [(string | Node)[], string][] = [
        [['say "hi" \\ ${x} $${y} \t tab'], 'say "hi" \\ ${x} $${y} \t tab'],
        [["line1\nline2"], "line1\nline2"],
        [["\nleading newline"], "\nleading newline"],
        [["trailing newline\n"], "trailing newline\n"],
        [["\n\n\nblank lines\n\n"], "\n\n\nblank lines\n\n"],
        [["  indented\n  both lines"], "  indented\n  both lines"],
        [["a\n  "], "a\n  "],
        [["a\n   \nb\n \n"], "a\n   \nb\n \n"],
        [["\ttabs\n\tonly"], "\ttabs\n\tonly"],
        [["it's\n'quoted' ''two'' '''three''' ''''four''''\nends with '"], "it's\n'quoted' ''two'' '''three''' ''''four''''\nends with '"],
        [["${ and ''${ and $${ and '${ and '$\nx $"], "${ and ''${ and $${ and '${ and '$\nx $"],
        [["''\\n ''\\ \\\n\\"], "''\\n ''\\ \\\n\\"],
        [["a$", X, "b"], "a$Xb"],
        [["line\n'", X, "'\n$", X, "$"], "line\n'X'\n$X$"],
        [["'", X, "'"], "'X'"],
        [[X, "\n", X], "X\nX"],
        [["  ", X, "\n  y"], "  X\n  y"],
        [["x\n$", X, "\n'"], "x\n$X\n'"],
    ]

    it("strings, also nested inside sets and lists", () => {
        const flat = new List(strings.map(([pieces]) => new Str(pieces)))
        const nested = new AttrSet({ a: new List([new AttrSet({ b: flat })]) })
        const code = emit(new List([flat, nested]))
        const expected = strings.map(([, text]) => text)
        expect(evalNix(code)).toEqual([expected, { a: [{ b: expected }] }])
    })

    it("numbers, calls and attribute names", () => {
        const numbers = new List([new Num(-1), new Num(0), new Num(0.5), new Num(-2.5), new Num(1e-7), new Num(1e21)])
        const add = new Call(new Select(new Var("builtins"), ["add"]), [new Num(-1), new Num(3)])
        const attrs = new AttrSet({ "or": new Num(1), "a b": new Num(2), "${x}": new Num(3), "": new Num(4) })
        const code = emit(new List([numbers, add, attrs]))
        expect(evalNix(code)).toEqual([[-1, 0, 0.5, -2.5, 1e-7, 1e21], 2, { "or": 1, "a b": 2, "${x}": 3, "": 4 }])
    })
})

function evalNix(code: string): unknown {
    return JSON.parse(execFileSync("nix-instantiate", ["--eval", "--strict", "--json", "-E", code], { encoding: "utf8" }))
}
