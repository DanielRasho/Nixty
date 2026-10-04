import type { License, System } from "../constants.js"
import { NixtyError } from "../errors.js"

// ==================
//  NIX VALUE
// ==================

/**
 * Base of every Nixty primitive. Using one as plain text (`${value}`, `"a" + value`, `JSON.stringify`)
 * throws an error instead of silently writing `[object Object]`. Put it inside nix`...` instead.
 */
abstract class NixValue {
    toString(): never {
        return NixValue.#textError()
    }

    [Symbol.toPrimitive](): never {
        return NixValue.#textError()
    }

    toJSON(): never {
        return NixValue.#textError()
    }

    static #textError(): never {
        throw new NixtyError("A Nixty value can't be used as plain text; put it inside nix`...` instead.")
    }
}

// ==================
//  PATH
// ==================

/** Represents a path to a file or folder in the Nix Store. 
 * If something is not present on the store, nix  fetch it over the network before saying where 
 * its located on the the store, this class offer methods for that to.
 *
 * **Important:** Changes to the original resources will not be shown on your PC until you run `nixty update`
 */
export class Path extends NixValue {
    #url : string
    #isLocal: boolean
    #parent: Path

    /** For the compiler: the Nix code this value stands for. */
    node() {
        //TODO:
    }
    
    /** Returns a new path starting from an original path*/
    subPath (subpath: string): Path {
        let p = new Path()
        p.#parent = this
        p.#url = subpath // maybe requires some extra processing
        return p;
    }

    /** Fetches a file or folder from inside your project folder. Provide a relative path. Ex: `./main.py` */
    static fetchInternalPath(subpath: string) : Path{
        // Make sure is a relative path
        let p = new Path()
        p.#isLocal = true
        return p;
    }
    
    /** Fetches a file or folder from your PC  outside your project folder. Ex: `/etc/python/config.yml` */
    static fetchExternalPath(externalPath: string) : Path{
        let p = new Path()
        return p;
    }
    
    /** Fetches a git repository from the web.*/
    static fetchFromGit({url, submodules, tag, commit} : GitOptions ) : Path{
        // TODO: add exclusive tag or commit error
        let p = new Path()
        return p;
    }

    /** Fetches a mercurial repository.*/
    static fetchFromMercurial({url, tag, commit} : MercurialOptions) : Path{
        let p = new Path()
        return p;
    }

    /** Fetches a tarball, zip, tar or tgz.*/
    static fetchFromTarball({url, hash}: TarballOptions) : Path{
        let p = new Path()
        return p;
    }

    /** Fetches a repository from GitHub. **Pass either a tag or a commit, not both.** */
    static fetchFromGithub({owner, repo, tag, commit}: GithubOptions) : Path{
        if (tag != undefined && commit != undefined) {
            throw new NixtyError(`On Path :${owner} Pass either a tag or a commit, not both.`)
        }
        const p = new Path();
        p.#url = "" // <- build url

        return p;
    }

    /** Fetches a repository from GitLab. **Pass either a tag or a commit, not both.***/
    static fetchFromGitLab({owner, repo, tag, commit}: GitLabOptions) : Path{
        // TODO: add exclusive tag or commit error
        let p = new Path()
        return p;
    }

    /** Fetches a repository from SourceHut. **Pass either a tag or a commit, not both.***/
    static fetchFromSourceHut({owner, repo, tag, commit} : SourceHutOptions) : Path{
        // TODO: add exclusive tag or commit error
        let p = new Path()
        return p;
    }
}

export interface GitOptions {
    /** URL to the repository*/
    url : string
    /** Download the repo git submodules.*/
    submodules: boolean
    /** tag or branch name. Ex: develop, release-1.0*/
    tag?: string
    /** specific commit hash*/
    commit?: string
}

export interface MercurialOptions {
    /** URL to the repository*/
    url : string
    /** tag or branch name. Ex: develop, release-1.0*/
    tag?: string
    /** specific commit hash*/
    commit?: string
}

export interface TarballOptions {
    /** Download link. Ex: https://example.com/app-1.0.tar.gz */
    url : string
    /** Expected hash of the file; Nix refuses the download if it doesn't match.*/
    hash?: string
}

export interface GithubOptions {
    /** Owner of the repository. Ex: torvalds */
    owner : string
    /** Repository name. Ex: nixty */
    repo: string
    /** tag or branch name. Ex: develop, release-1.0*/
    tag?: string
    /** specific commit hash*/
    commit?: string
}

export interface GitLabOptions {
    /** Owner of the repository. Ex: torvalds */
    owner : string
    /** Repository name. Ex: nixty */
    repo: string
    /** tag or branch name. Ex: develop, release-1.0*/
    tag?: string
    /** specific commit hash*/
    commit?: string
}

export interface SourceHutOptions {
    /** Owner of the repository. Ex: torvalds */
    owner : string
    /** Repository name. Ex: nixty */
    repo: string
    /** tag or branch name. Ex: develop, release-1.0*/
    tag?: string
    /** specific commit hash*/
    commit?: string
}

// ====================
//  NIX STRING
// ====================

/** A string that may contain references to other Nixty values, produced by `nix` method. eg: 
 * ```
 * nix`npm install ${out}`
 * ```
 * */
export class NixString extends NixValue {
    // The text pieces between the `${}`, and the values inside them: nix`a ${x} b` has
    // strings ["a ", " b"] and values [x]. There is always one more string than values.
    #strings: readonly string[]
    #values: readonly Interpolable[]

    constructor(strings: readonly string[], values: readonly Interpolable[]) {
        super()
        this.#strings = strings
        this.#values = values
    }

    /** The text pieces and values of `str`, for the compiler. */
    static partsOf(str: NixString): { strings: readonly string[]; values: readonly Interpolable[] } {
        return { strings: str.#strings, values: str.#values }
    }
}

/** What Nix can turn into a string, and so what `nix\`...\`` accepts inside `${}`. */
// An `Expresion` can be any Nix value; one that can't become text (e.g. an attribute set) fails when
// Nix evaluates the flake, since TypeScript can't know its type.
export type Interpolable = Derivation | Path | NixString | Source | Expresion | string | number;

/**
 * Build a Nix string that keeps references to the values inside it:
 *
 *     nix`install ${DefaultConfig(system)}`
 *
 * As a tagged template it receives the values themselves rather than their string form, so the
 * dependency on `DefaultConfig(system)` is kept.
 */
export function nix(strings: TemplateStringsArray, ...values: Interpolable[]) : NixString {
    return new NixString([...strings], values)
}

// ==================
//  EXPRESION
// ==================

// An `Expresion` records what is done to it (`.attr`, `[0]`, `(args)`) so the compiler can write it as
// Nix later. In order:
//   1. `ExpresionStep`: what gets recorded.
//   2. `CallableProxy`: the Proxy that catches every `.attr`, `[0]` and `(args)`.
//   3. `Expresion`: an interface and a class with the same name, merged by TypeScript into one type.

/** One recorded step. The compiler reads it with `Expresion.stepOf` and follows `of`/`fn` back to the root. */
export type ExpresionStep =
    /** `import <path>` */
    | { kind: "import"; path: Path }
    /** The outputs of the flake at `path` (its input, e.g. `other`), which `import` can't reach. */
    | { kind: "flake"; path: Path }
    /** `<of>.<name>` */
    | { kind: "attr"; of: Expresion; name: string }
    /** `builtins.elemAt <of> <index>` */
    | { kind: "index"; of: Expresion; index: number }
    /** `<fn> <arg> <arg> ...` */
    | { kind: "call"; fn: Expresion; args: NixArg[] }

/** A value that can be passed to a Nix function. Plain JS values are written as Nix primitives. */
export type NixArg = string | number | boolean | null | Path | NixString | Expresion | NixArg[] | { [name: string]: NixArg }

/**  To prevent an Expresion to work with reserved words like `await` reads `then`...
 *  its necesary to catch those cases. The proxy answers `undefined` for them. */
const RESERVED = new Set([
    "then",
    "constructor",
    "asymmetricMatch",
    "nodeType",
    "$$typeof",
    "@@__IMMUTABLE_ITERABLE__@@",
    "@@__IMMUTABLE_RECORD__@@",
])

const LIST_INDEX = /^(0|[1-9][0-9]*)$/

/**
 * Its constructor returns a `Proxy` instead of `this`, which makes a subclass's `#` fields land on the
 * proxy itself (`#` fields are read from the object you hold, never through the proxy's hooks).
 */
class CallableProxy {
    constructor(hooks: {
        get(self: any, key: string | symbol): unknown
        call(self: any, args: unknown[]): unknown
    }) {
        // Only a proxy around a function can be called. An arrow function, because a regular one has a
        // `prototype` property the proxy would be forced to report instead of the Nix attribute.
        const target = () => {}
        Object.setPrototypeOf(target, new.target.prototype)
        const self: object = new Proxy(target, {
            get: (_, key) => hooks.get(self, key),
            has: (_, key) => typeof key === "string" && !RESERVED.has(key),
            apply: (_, __, args) => hooks.call(self, args),
            set: CallableProxy.#readOnlyError,
            defineProperty: CallableProxy.#readOnlyError,
            deleteProperty: CallableProxy.#readOnlyError,
        })
        return self
    }

    static #readOnlyError(): never {
        throw new NixtyError("An Expresion is read-only; its attributes can't be set or deleted.")
    }
}

/**
 * The types of what the proxy does. TypeScript can't see through a Proxy, so this interface declares
 * it; having the class's name, it is merged into the class's type (declaration merging). Unlike
 * `implements`, nothing checks it: `#get` and the `call` hook below are what make it true.
 */
export interface Expresion {
    /** `expr.name`: an attribute. */
    readonly [name: string]: Expresion
    /** `expr[0]`: a list element. */
    readonly [index: number]: Expresion
    /** `expr(a, b)`: a call (`expr a b`). */
    (...args: NixArg[]): Expresion
}

/**
 * Any Nix value. Each use returns a new `Expresion` recording one more step:
 *
 *     const pkgs = new Expresion(path)          // import <path>
 *     pkgs.legacyPackages["x86_64-linux"].go    // attributes
 *     pkgs.someList[0]                          // list index
 *     pkgs.writeText("name", "content")         // call
 *
 * Every `.name` is a Nix attribute, so it has no methods; its helpers are static.
 */
export class Expresion extends CallableProxy {
    #step: ExpresionStep
    // The same `.name` or `[i]` returns the same object, so the compiler can tell it's shared.
    #children = new Map<string | number, Expresion>()

    constructor(source: Path)
    constructor(source: Path | ExpresionStep) {
        super({
            get: (self: Expresion, key) => self.#get(key),
            call: (self: Expresion, args) => Expresion.#derive({ kind: "call", fn: self, args: args as NixArg[] }),
        })
        this.#step = source instanceof Path ? { kind: "import", path: source } : source
    }

    /** The attribute `name`, for names `expr.name` can't reach: numbers and `RESERVED` names. */
    static attr(expr: Expresion, name: string): Expresion {
        return expr.#child(name)
    }

    /** The outputs of the flake at `path` (`packages`, `apps`, ...), instead of `import <path>`. */
    static flakeOutputs(path: Path): Expresion {
        return Expresion.#derive({ kind: "flake", path })
    }

    /** Return the last step recorded for `expr`. */
    static stepOf(expr: Expresion): ExpresionStep {
        return expr.#step
    }

    // Users can only pass a `Path` to the constructor; other steps come from here.
    static #derive(step: ExpresionStep): Expresion {
        return new (Expresion as unknown as new (step: ExpresionStep) => Expresion)(step)
    }

    /** Answers `expr.key` and `expr[key]`: a list index for numbers, an attribute otherwise. */
    #get(key: string | symbol): unknown {
        // JS asks for these to turn `expr` into a string (`${expr}`, `JSON.stringify(expr)`).
        if (key === Symbol.toPrimitive || key === "toJSON") return Expresion.#coercionError
        if (typeof key === "symbol" || RESERVED.has(key)) return undefined
        return this.#child(LIST_INDEX.test(key) ? Number(key) : key)
    }

    /** The `Expresion` one attribute (string) or index (number) below this one, made once and cached. */
    #child(key: string | number): Expresion {
        let child = this.#children.get(key)
        if (child === undefined) {
            child = Expresion.#derive(
                typeof key === "number"
                    ? { kind: "index", of: this, index: key }
                    : { kind: "attr", of: this, name: key },
            )
            this.#children.set(key, child)
        }
        return child
    }

    static #coercionError(): never {
        throw new NixtyError("An Expresion can't be turned into a JS string; put it inside nix`...` instead.")
    }
}

// ==================
//  SOURCE
// ==================

/** Represents a file or folder that lives on the Nix Store.
 * 
 * **You can use it to specify the source code to build a package. Ex:**.
 * ```ts
 * const src = new Source(Path.fetchFromGithub({ owner: "me", repo: "app", tag: "v1.0" }))
 * ```
*/
export class Source extends NixValue {
    #path: Path
    constructor(path: Path) {
        super()
        this.#path = path
    }

    /** For the compiler: the Nix code this value stands for. */
    node() {
        //TODO:
    }
}

// ==================
//  DERIVATION
// ==================

/** Names of things Nix builds become part of a folder name, so Nix only allows letters, digits and `+ - . _ ? =`. */
export const VALID_DERIVATION_NAME = /^[A-Za-z0-9+\-._?=]+$/

/** Possible kinds of derivations*/
export enum DerivationKind {
    /** Defined in Nixty */
    INTERNAL,
    /** Written with nix on external files. Nixty can use it but can't access its attributes. e.g: nixpkgs packages.*/
    EXTERNAL
}

/** Represents a recipe to build a program for certain system.
 * For Nix users, its a simplified wrapper around `nixpkgs.stdenv.mkDerivation`
 * 
 * There are 2 ways to create one:
 * - **INTERNAL:** using `Derivation.fromDefinition(...)` you write the recipe here, in Nixty.
 * - **EXTERNAL:** using `Derivation.fromExpresion(...)` an existing recipe written in Nix, e.g. a package from nixpkgs.
 *   Nixty can use it but can't access its attributes.
*/
export class Derivation extends NixValue {
    #kind: DerivationKind
    // Only INTERNAL ones: an EXTERNAL derivation already has its name in Nix.
    #name: string | null = null
    #system: System | null = null;
    #expresion: Expresion | null = null
    #definition: DerivationDefinition | null = null

    /** `name` must match `VALID_NAME`. */
    static fromDefinition(name: string, system: System, definition: DerivationDefinition) : Derivation{
        // TODO: validate dependencies are derivations from the same system
        // TODO: Prevent cyclic dependencies? I don't now if nix prevents those
        if (name.trim() === "")
            throw new NixtyError("A package needs a name.")
        if (!VALID_DERIVATION_NAME.test(name))
            throw new NixtyError(`"${name}" is not a valid package name: use only letters, digits and + - . _ ? =`)
        const d = new Derivation()
        d.#kind = DerivationKind.INTERNAL
        d.#name = name
        d.#system = system
        d.#definition = definition
        return d
    }
    
    static fromExpresion(system: System, expr: Expresion) : Derivation {
        const d = new Derivation()
        d.#kind = DerivationKind.EXTERNAL
        d.#system = system
        d.#expresion = expr
        return d;
    }
    
    /** Returns an independent derivation that is a deep copy of the current one.*/
    clone() : Derivation {
        // TODO: to implement
        const d = new Derivation()
        return d;
    }
    
    /** If the derivation is INTERNAL (defined within Nixty), it returns its list of dependencies */
    dependencies() : DerivationDeps | null {
        if (this.#kind == DerivationKind.EXTERNAL) 
            return null
        else 
            return this.#definition ? this.#definition.deps : null
    }
    
    /** The name given to `fromDefinition`; `null` for an EXTERNAL derivation. */
    name() : string | null {
        return this.#name
    }

    /** Returns the system this derivation is meant to build upon. */
    system() : System | null{
        return this.#system
    }
    
    /** Returns the kind of derivation (`INTERNAL`, `EXTERNAL`)*/
    isExternal() : DerivationKind {
        return this.#kind;
    }
    
    /** For the compiler: the Nix code this value stands for. */
    node () {
        // TODO: to implement
    }
}

export interface DerivationDefinition {
    /** Version of this Program */
    version: string;
    /** The source code to build. */
    src: Source;
    /** Dependencies required to build and run this program */
    deps: DerivationDeps;
    /** Shell commands for each build step. `out` is the folder where nix want you to write the installation files into
    *  (e.g. `install: cp app ${out}/bin/`). */
    phases: (out: string) => DerivationPhases
    /** Information about this package*/
    metadata?: {
        /** What this program does */
        description?: string;
        /** Official webpage */
        homepage?: string;
        /** Distribution license */
        license?: License;
        /** Main executable file */
        mainProgram?: string;
    }
}

/** The package dependencies, grouped by when it's needed. (Nix's equivalent in brackets.) */
export interface DerivationDeps {
  /** Tools run while building, like a compiler. Not included in the result. [nativeBuildInputs] */
  atBuild?: Derivation[];
  /** Programs the result runs; they're added to its PATH, so users don't install them. */
  atRuntime?: Derivation[];
  /** Tools only the tests use. [nativeCheckInputs] */
  atTest?: Derivation[];
  /** Libraries your code links against. [buildInputs] */
  linkedLibs?: Derivation[];
  /** Like `linkedLibs`, but anything that depends on this package gets them too.
   *  Use when packages that uses your library also needs these libraries. [propagatedBuildInputs] */
  linkedAndExportedLibs?: Derivation[];
}

/**
 * The standard steps of nixpkgs (`stdenv.mkDerivation`), for projects built with `./configure` and
 * `make`. Use one as a phase to run that step the usual way: `build: DefaultPhases.BUILD`.
 *
 * Each one does nothing when its file is missing (no `./configure`, no Makefile). Build tools in
 * `atBuild` (cmake, meson, ...) don't change them.
 */
// TODO: add typing
export const DefaultPhases = Object.freeze({
    /** Runs `./configure --prefix=$out`, adding `--disable-dependency-tracking` and `--disable-static`
     *  when the script supports them. */
    CONFIGURE: nix`configurePhase`,
    /** Runs `make`. Uses one CPU core. */
    BUILD : nix`buildPhase`,
    /** Runs `make check`, or `make test` if there's no `check` target, with `VERBOSE=y`. */
    TEST : nix`checkPhase`,
    /** Creates `out` and runs `make install`. */
    INSTALL: nix`installPhase`
})

/**
 * Packages are build in phases, each phase is a list of shell commands to run.
 * - `undefined` or `null` phases are not run
 * - check `DefaultPhases` for premade commands for projects using `make`
 */
// TODO: the implementation should add prehook and posthooks at the during this phases 
export interface DerivationPhases {
    /** Prepare the build, e.g. `./configure`. */
    configure?: NixString | null,
    /** Compile, e.g. `make`. */
    build?: NixString | null,
    /** Run the tests. Writing it turns tests on, whatever is in `atTest`. */
    test?: NixString | null,
    /** Copy the result into `out`. Must put something in out, or the build fails.*/
    // TODO: when `out` is still missing after install, fail with a Nixty message ("nothing was installed
    // into `out`: write an `install` phase ...") instead of Nix's "failed to produce output path". Must
    // run inside the build (e.g. in `postInstall`, which the default install runs): only the build can
    // see that the source has no Makefile for the default install.
    install?: NixString,
    /** Extra adjustments to the installed files, run after Nix's own fixup (which always runs). Rarely needed. */
    postFixup?: NixString | null
}
