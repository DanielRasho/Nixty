import { existsSync, writeFileSync } from "node:fs"
import type { Definition } from "./api/definition.js"
import { NixtyError } from "./errors.js"
import { emitFlake } from "./phases/emit.js"
import { expand } from "./phases/expand.js"
import { loadDefinition } from "./phases/load.js"
import { chooseNames } from "./phases/naming.js"
import { checkTypes } from "./phases/typecheck.js"
import { walk } from "./phases/walk.js"

/** Turns a definition into flake.nix `text: expand -> walk -> naming -> emit.` */
export function compile(definition: Definition): string {
  const graphs = expand(definition)
  const walked = walk(graphs)
  const names = chooseNames(walked)
  return emitFlake(definition, graphs, walked, names)
}

export interface GenerateOptions {
  /** Path to the TypeScript file describing the flake. @default "nixty.ts" */
  file?: string;
  /** Output path for the generated Nix file. Empty: nothing is written, the text is only returned.
   *  @default "flake.nix" */
  out?: string;
  /** Typecheck the input before generating. @default true */
  typecheck?: boolean;
}

/** Generates a flake.nix given a nixty file which exports default a nixty Definition. Eg:
 *
 *      const d = new Definition({...});
 *      export default definition;
 *
 * Type-checks the file (any error stops here), runs it, compiles its definition and writes the result
 * to `out`. Returns the flake.nix text.
 */
export async function generate({
  file = "nixty.ts",
  out = "flake.nix",
  typecheck = true,
}: GenerateOptions = {}): Promise<string> {
  if (!existsSync(file)) throw new NixtyError(`${file} not found.`)
  if (typecheck) {
    const result = checkTypes(file)
    if (!result.ok) throw new NixtyError(`${file} has type errors:\n${result.output}`)
  }
  const text = compile(await loadDefinition(file))
  if (out !== "") {
    try {
      writeFileSync(out, text)
    } catch (error) {
      throw new NixtyError(`Can't write ${out}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return text
}
