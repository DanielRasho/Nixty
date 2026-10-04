import type { Derivation } from "../../../dist/index.js";
import { NixtyError } from "../errors.js";
import type { Command } from "./command.js";
import type { DevShell } from "./devShell.js";
import type { Nixpkgs } from "./helpers.js";
import type { Package } from "./package.js";

export interface DefinitionOptions {
  /** General description of this project */
  description?: string;
  /** */
  nixpkgs: Nixpkgs;
  /** List of applications shipped in this project */
  packages?: (Package | Derivation)[];
  /** List of development shells this project support */
  devShells?: DevShell[];
  /** List of commands to run in a define environment*/
  commands?: Command[];
}

/** 
 * A definition is the basic Nixty unit for a project. It contains all the apps, dev shells and commands
 * it will need. Is meant to be exported from your `nixty.ts` file.
 * 
 *      const definition = new Definition({...})
 *      export default definition
 *
 * For nix users, its a simplified Flake.
*/
export class Definition {
    description:string;
    nixpkgs:Nixpkgs;
    packages: (Package | Derivation)[];
    devShells:DevShell[];
    commands:Command[];

    constructor({description, nixpkgs, packages, devShells, commands}: DefinitionOptions) {
        // test packages, devshells and commands have unique names each
    }
    
    node() {
        // TODO: 
    }

    unique(kind: string, outputs: readonly { name: string }[]): void {
        const seen = new Set<string>();
        for (const { name } of outputs) {
            if (seen.has(name)) throw new NixtyError(`two ${kind}s are named "${name}"`);
            seen.add(name);
        }
    }
}