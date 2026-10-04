import type { System } from "../constants.js";
import { NixtyError } from "../errors.js";
import { Derivation, Expresion, Path } from "./primitives.js";

export interface NixpkgsOptions {
    /** Branch or tag to follow, e.g. `"nixos-25.05"` (stable) or `"nixos-unstable"` (newest). The exact
     *  commit used is recorded in `flake.lock`; `nixty update` moves it forward. */
    tag?: string,
    /** A specific commit hash, for when you need exactly that version and never want it to move. */
    commit?: string,
    /** Allow packages whose license isn't open source (e.g. `discord`, `steam`). Nix refuses to build
     *  them otherwise. */
    allowUnfree?: boolean
}

/**
 * Nixpkgs, Nix's official package collection: over 100,000 programs and libraries, from `go` to
 * `firefox`, that you can use as tools, dependencies or building blocks.
 *
 *     const NIX_PKGS = new Nixpkgs({ tag: "nixos-25.05" })
 *     const [go, nodejs] = NIX_PKGS.getPackages(["go", "nodejs_22"], system)
 *
 * Browse what's available at https://search.nixos.org/packages.
 */
export class Nixpkgs {
    
    #path: Path
    // `import <nixpkgs>`: a function that takes the system and settings and returns the package set.
    #rootExpresion: Expresion
    // `import <nixpkgs>/lib`: the helper library, which doesn't depend on the system.
    #lib: Expresion
    #allowUnfree: boolean
    // One package set per system, so every lookup on that system shares it.
    #pkgs = new Map<System, Expresion>()

    constructor({tag, commit, allowUnfree = true} : NixpkgsOptions) {
        if (tag !== undefined && commit !== undefined)
            throw new NixtyError("Nixpkgs: pass either a tag or a commit, not both.")
        if (tag === undefined && commit === undefined)
            throw new NixtyError("Nixpkgs: pass a tag (e.g. \"nixos-25.05\") or a commit.")
        this.#path = Path.fetchFromGithub({
            owner: "NixOS",
            repo: "nixpkgs",
            ...(tag === undefined ? {} : { tag }),
            ...(commit === undefined ? {} : { commit }),
        })
        this.#rootExpresion = new Expresion(this.#path)
        this.#lib = new Expresion(this.#path.subPath("lib"))
        this.#allowUnfree = allowUnfree
    }

    /** The packages with these names, built for `system`, in the same order. A misspelled name is only
     *  caught when Nix evaluates the flake, not by Nixty. */
    getPackages<const Names extends readonly string[]>(
        packages: Names,
        system: System,
    ): { -readonly [I in keyof Names]: Derivation } {
        return packages.map((name) => Derivation.fromExpresion(system, this.getExpresion(name, system))) as
            { -readonly [I in keyof Names]: Derivation }
    }

    /** A function or value from `lib`, nixpkgs' helper library (string, list and attribute-set
     *  utilities, licenses, ...), by its dot-separated path, e.g. `"strings.concatStringsSep"`. */
    getLib(path: string) : Expresion {
        return selectPath(this.#lib, path)
    }

    /** Any attribute of nixpkgs for `system`, by its dot-separated path, for what `getPackages` and
     *  `getLib` don't cover, e.g. `"python3Packages.requests"`. */
    getExpresion(path: string, system: System) : Expresion {
        return selectPath(this.#pkgsFor(system), path)
    }

    /** `import <nixpkgs> { system = ...; config.allowUnfree = ...; }`, made once per system. */
    #pkgsFor(system: System): Expresion {
        let pkgs = this.#pkgs.get(system)
        if (pkgs === undefined) {
            pkgs = this.#rootExpresion({ system, config: { allowUnfree: this.#allowUnfree } })
            this.#pkgs.set(system, pkgs)
        }
        return pkgs
    }
}

/**
 * Another flake: a project that shares its packages, tools and dev shells through Nix. Use it to
 * build on someone else's work without copying it.
 *
 *     const OTHER = new Flake(Path.fetchFromGithub({ owner: "me", repo: "tools", tag: "v1.0" }))
 *     const [cli] = OTHER.getPackages(["cli"], system)
 *
 * Look in the other project's `flake.nix` for what it offers, or run `nix flake show <url>`.
 */
export class Flake {
    readonly path : Path
    // The flake's outputs: `packages`, `apps`, `devShells`, ...
    #outputs: Expresion
    
    constructor(path: Path) {
        this.path = path
        this.#outputs = Expresion.flakeOutputs(path)
    }

    /** The packages with these names, built for `system`, in the same order. */
    getPackages<const Names extends readonly string[]>(
        names: Names,
        system: System,
    ): { -readonly [I in keyof Names]: Derivation } {
        return this.#getAll("packages", names, system) as { -readonly [I in keyof Names]: Derivation }
    }

    /** The dev shells with these names, for `system`, in the same order. Use one as a base for your own
     *  shell to get the same tools. */
    getDevShells<const Names extends readonly string[]>(
        names: Names,
        system: System,
    ): { -readonly [I in keyof Names]: Derivation } {
        return this.#getAll("devShells", names, system) as { -readonly [I in keyof Names]: Derivation }
    }

    /** The program an app runs, for `system`. Use it inside a command, e.g. nix`${app} --help`. */
    getApp(name: string, system: System): Expresion {
        return Expresion.attr(this.#forSystem("apps", system), name).program
    }

    /** Any output of the flake, by its dot-separated path, for what the other methods don't cover,
     *  e.g. `"lib.mkConfig"` or `"overlays.default"`. */
    getExpresion(path: string): Expresion {
        return selectPath(this.#outputs, path)
    }

    /** `<category>.<system>`, e.g. `packages.x86_64-linux`. */
    #forSystem(category: string, system: System): Expresion {
        return Expresion.attr(Expresion.attr(this.#outputs, category), system)
    }

    /** `<category>.<system>.<name>` for each name, as derivations. */
    #getAll(category: string, names: readonly string[], system: System): Derivation[] {
        const forSystem = this.#forSystem(category, system)
        return names.map((name) => Derivation.fromExpresion(system, Expresion.attr(forSystem, name)))
    }
}

/** Follows a dot-separated attribute path from `expr`: `"a.b"` is `expr.a.b`. */
function selectPath(expr: Expresion, path: string): Expresion {
    const names = path.split(".")
    if (names.some((name) => name === ""))
        throw new NixtyError(`"${path}" is not a valid attribute path: use names separated by dots, e.g. "a.b".`)
    return names.reduce((parent, name) => Expresion.attr(parent, name), expr)
}
