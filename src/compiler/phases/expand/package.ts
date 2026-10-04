// An INTERNAL derivation (a `Package` for one system) as `pkgs.stdenv.mkDerivation { ... }`.
import { AttrSet } from "../../ast/attrSet.js"
import { Call } from "../../ast/call.js"
import { List } from "../../ast/list.js"
import type { Node, NodeOptions } from "../../ast/node.js"
import { Select } from "../../ast/select.js"
import { Str } from "../../ast/str.js"
import { Var } from "../../ast/var.js"
import {
    DefaultPhases,
    type Derivation,
    type DerivationDefinition,
    type DerivationPhases,
    type NixString,
} from "../../api/primitives.js"
import type { ExpandContext } from "./context.js"
import { derivationNode, pkgsNode, strNode, valueNode } from "./values.js"

/** Each phase: its attribute, the `DefaultPhases` entry that means "the default", and how to skip it. */
const PHASES: { key: keyof DerivationPhases; attr: string; standard: NixString | null; skip: string | null }[] = [
    { key: "configure", attr: "configurePhase", standard: DefaultPhases.CONFIGURE, skip: "dontConfigure" },
    { key: "build", attr: "buildPhase", standard: DefaultPhases.BUILD, skip: "dontBuild" },
    // Tests are off unless a test phase is given, so there's nothing to skip.
    { key: "test", attr: "checkPhase", standard: DefaultPhases.TEST, skip: null },
    { key: "install", attr: "installPhase", standard: DefaultPhases.INSTALL, skip: "dontInstall" },
]

/**
 * The `mkDerivation` call building `name` from `definition`:
 *
 * - deps: `atBuild` -> `nativeBuildInputs`, `linkedLibs` -> `buildInputs`, `linkedAndExportedLibs` ->
 *   `propagatedBuildInputs`, `atTest` -> `nativeCheckInputs`, and `atRuntime` -> `makeWrapper` plus a
 *   `postFixup` that puts them on the `PATH` of every program in `$out/bin`.
 * - phases: a missing (or `null`) phase is skipped, a `DefaultPhases` entry runs the standard one, and
 *   a test phase turns tests on (`doCheck`).
 */
export function packageNode(ctx: ExpandContext, name: string, definition: DerivationDefinition, options: NodeOptions): Node {
    const deps = definition.deps
    const atRuntime = derivations(ctx, deps.atRuntime)
    const attrs: Record<string, Node> = {
        pname: new Str([name]),
        version: new Str([definition.version]),
        src: valueNode(ctx, definition.src),
    }
    const nativeBuildInputs = derivations(ctx, deps.atBuild)
    if (atRuntime.length > 0) nativeBuildInputs.push(pkgsNode(ctx, "makeWrapper"))
    addList(attrs, "nativeBuildInputs", nativeBuildInputs)
    addList(attrs, "buildInputs", derivations(ctx, deps.linkedLibs))
    addList(attrs, "propagatedBuildInputs", derivations(ctx, deps.linkedAndExportedLibs))
    addList(attrs, "nativeCheckInputs", derivations(ctx, deps.atTest))

    const phases = definition.phases("$out")
    for (const { key, attr, standard, skip } of PHASES) {
        const phase = phases[key]
        if (phase === undefined || phase === null) {
            if (skip !== null) attrs[skip] = new Var("true")
            continue
        }
        if (key === "test") attrs["doCheck"] = new Var("true")
        if (phase !== standard) attrs[attr] = strNode(ctx, phase)
    }
    const postFixup: Node[] = []
    if (atRuntime.length > 0) postFixup.push(wrapPrograms(ctx, atRuntime))
    if (phases.postFixup !== undefined && phases.postFixup !== null) postFixup.push(strNode(ctx, phases.postFixup))
    if (postFixup.length > 0) attrs["postFixup"] = new Str(join(postFixup, "\n"))

    const meta = metaNode(ctx, definition)
    if (meta !== null) attrs["meta"] = meta
    return new Call(pkgsNode(ctx, "stdenv.mkDerivation"), [new AttrSet(attrs)], options)
}

/** Shell code putting `programs` on the `PATH` of every program the package installs. */
function wrapPrograms(ctx: ExpandContext, programs: Node[]): Node {
    const binPath = new Call(pkgsNode(ctx, "lib.makeBinPath"), [new List(programs)])
    return new Str([
        'for f in "$out"/bin/*; do\n  wrapProgram "$f" --prefix PATH : ',
        binPath,
        "\ndone",
    ])
}

/** `meta = { description; homepage; license; mainProgram; }`, or `null` when none is given. */
function metaNode(ctx: ExpandContext, definition: DerivationDefinition): Node | null {
    const metadata = definition.metadata
    if (metadata === undefined) return null
    const attrs: Record<string, Node> = {}
    if (metadata.description !== undefined) attrs["description"] = new Str([metadata.description])
    if (metadata.homepage !== undefined) attrs["homepage"] = new Str([metadata.homepage])
    if (metadata.license !== undefined) attrs["license"] = new Select(pkgsNode(ctx, "lib.licenses"), [metadata.license.id])
    if (metadata.mainProgram !== undefined) attrs["mainProgram"] = new Str([metadata.mainProgram])
    return Object.keys(attrs).length > 0 ? new AttrSet(attrs) : null
}

function derivations(ctx: ExpandContext, list: Derivation[] | undefined): Node[] {
    return (list ?? []).map((d) => derivationNode(ctx, d))
}

/** Sets `attrs[name]` to a list of `items`, unless there are none. */
function addList(attrs: Record<string, Node>, name: string, items: Node[]): void {
    if (items.length > 0) attrs[name] = new List(items)
}

/** `items` with `separator` between each two. */
function join(items: Node[], separator: string): (string | Node)[] {
    return items.flatMap((item, i) => (i === 0 ? [item] : [separator, item]))
}
