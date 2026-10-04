// A `DevShell` for one system as `pkgs.mkShell { ... }`.
import { AttrSet } from "../../ast/attrSet.js"
import { Call } from "../../ast/call.js"
import { List } from "../../ast/list.js"
import type { Node } from "../../ast/node.js"
import { Str } from "../../ast/str.js"
import type { DevShell } from "../../api/devShell.js"
import type { ExpandContext } from "./context.js"
import { derivationNode, pkgsNode, valueNode } from "./values.js"

/** `pkgs.mkShell { name; packages; env; shellHook; }`, leaving out what's empty. */
export function devShellNode(ctx: ExpandContext, shell: DevShell): Node {
    const attrs: Record<string, Node> = { name: new Str([shell.name]) }
    const packages = shell.getPackages(ctx.system).map((d) => derivationNode(ctx, d))
    if (packages.length > 0) attrs["packages"] = new List(packages)
    const env = Object.entries(shell.env)
    if (env.length > 0) {
        const vars: Record<string, Node> = {}
        for (const [name, value] of env) vars[name] = valueNode(ctx, value)
        attrs["env"] = new AttrSet(vars)
    }
    if (shell.onEnter !== "") attrs["shellHook"] = valueNode(ctx, shell.onEnter)
    return new Call(pkgsNode(ctx, "mkShell"), [new AttrSet(attrs)], { suggestedName: shell.name })
}
