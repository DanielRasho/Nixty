// Phase "execute": run the user's file and take the definition it exports. There is no transpile step:
// Node (>= 22.18) runs .ts files itself by stripping the types, which also makes the user's own local
// imports work.
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { DEFINITION_BRAND, Definition } from "../api/definition.js"
import { NixtyError } from "../errors.js"

/** Runs `file` and returns its default export, checked to be a `Definition`. */
export async function loadDefinition(file: string): Promise<Definition> {
    const module = await import(pathToFileURL(resolve(file)).href)
    const value: unknown = module.default

    if (value instanceof Definition) return value
    if (typeof value === "object" && value !== null && DEFINITION_BRAND in value) {
        throw new NixtyError(
            `${file} was built with a different copy of nixty-lib than the one running. ` +
                "Run the project's own nixty (e.g. `pnpm exec nixty`).",
        )
    }
    throw new NixtyError(`${file} must end with \`export default new Definition({...})\`.`)
}
