// A `Command` for one system as a flake app running a `writeShellApplication` script.
import { AttrSet } from "../../ast/attrSet.js"
import { Call } from "../../ast/call.js"
import { List } from "../../ast/list.js"
import type { Node } from "../../ast/node.js"
import { Str } from "../../ast/str.js"
import type { Command } from "../../api/command.js"
import { NixtyError } from "../../errors.js"
import type { ExpandContext } from "./context.js"
import { derivationNode, pkgsNode, valueNode } from "./values.js"

/** Names a shell can `export`. */
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * `{ type = "app"; program = ...; }`, where the program is a script that exports `env` and then runs
 * the command, with `packages` on its `PATH`.
 */
export function commandNode(ctx: ExpandContext, command: Command): Node {
    const script: Record<string, Node> = { name: new Str([command.name]) }
    const packages = command.getPackages(ctx.system).map((d) => derivationNode(ctx, d))
    if (packages.length > 0) script["runtimeInputs"] = new List(packages)

    // `export NAME=${pkgs.lib.escapeShellArg "value"}`: Nix quotes the value for the shell.
    const text: (string | Node)[] = []
    for (const [name, value] of Object.entries(command.env)) {
        if (!ENV_NAME.test(name))
            throw new NixtyError(`"${name}" can't be an environment variable name: use letters, digits and _, not starting with a digit.`)
        text.push(`export ${name}=`, new Call(pkgsNode(ctx, "lib.escapeShellArg"), [valueNode(ctx, value)]), "\n")
    }
    text.push(valueNode(ctx, command.command), "\n")
    script["text"] = new Str(text)

    const app = new Call(pkgsNode(ctx, "writeShellApplication"), [new AttrSet(script)], { suggestedName: command.name })
    return new AttrSet({
        type: new Str(["app"]),
        program: new Call(pkgsNode(ctx, "lib.getExe"), [app]),
    })
}
