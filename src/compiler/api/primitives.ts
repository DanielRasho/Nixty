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
    #location: PathLocation

    /** Returns a new path starting from an original path*/
    subPath (subpath: string): Path {
        const names = subpath.split("/").filter((name) => name !== "" && name !== ".")
        if (names.length === 0 || names.includes(".."))
            throw new NixtyError(`"${subpath}" is not a valid sub path: name something inside the path, e.g. "lib" or "src/main.py".`)
        return Path.#at({ kind: "sub", parent: this, subpath: names.join("/") })
    }

    /** Fetches a file or folder from inside your project folder. Provide a relative path. Ex: `./main.py` */
    static fetchInternalPath(subpath: string) : Path{
        if (subpath.startsWith("/"))
            throw new NixtyError(`"${subpath}" is absolute: pass a path relative to your project, or use Path.fetchExternalPath.`)
        if (subpath === ".." || subpath.startsWith("../"))
            throw new NixtyError(`"${subpath}" is outside your project folder; use Path.fetchExternalPath for it.`)
        return Path.#at({ kind: "local", path: subpath })
    }

    /** Fetches a file or folder from your PC  outside your project folder. Ex: `/etc/python/config.yml` */
    static fetchExternalPath(externalPath: string) : Path{
        if (!externalPath.startsWith("/"))
            throw new NixtyError(`"${externalPath}" must be absolute (start with /); use Path.fetchInternalPath for files in your project.`)
        return Path.#input(`path:${externalPath}`, lastName(externalPath))
    }

    /** Fetches a git repository from the web.*/
    static fetchFromGit({url, submodules, tag, commit} : GitOptions ) : Path{
        onlyTagOrCommit(url, tag, commit)
        const query = new URLSearchParams()
        if (tag !== undefined) query.set("ref", tag)
        if (commit !== undefined) query.set("rev", commit)
        if (submodules) query.set("submodules", "1")
        return Path.#input(withQuery(withScheme("git", url), query), lastName(url))
    }

    /** Fetches a mercurial repository.*/
    static fetchFromMercurial({url, tag, commit} : MercurialOptions) : Path{
        onlyTagOrCommit(url, tag, commit)
        const query = new URLSearchParams()
        if (tag !== undefined) query.set("ref", tag)
        if (commit !== undefined) query.set("rev", commit)
        return Path.#input(withQuery(withScheme("hg", url), query), lastName(url))
    }

    /** Fetches a tarball, zip, tar or tgz.*/
    static fetchFromTarball({url, hash}: TarballOptions) : Path{
        const query = new URLSearchParams()
        if (hash !== undefined) query.set("narHash", hash)
        return Path.#input(withQuery(withScheme("tarball", url), query), lastName(url))
    }

    /** Fetches a repository from GitHub. **Pass either a tag or a commit, not both.** */
    static fetchFromGithub({owner, repo, tag, commit}: GithubOptions) : Path{
        onlyTagOrCommit(`${owner}/${repo}`, tag, commit)
        return Path.#input(hostedUrl("github", owner, repo, tag ?? commit), repo)
    }

    /** Fetches a repository from GitLab. **Pass either a tag or a commit, not both.***/
    static fetchFromGitLab({owner, repo, tag, commit}: GitLabOptions) : Path{
        onlyTagOrCommit(`${owner}/${repo}`, tag, commit)
        return Path.#input(hostedUrl("gitlab", owner, repo, tag ?? commit), repo)
    }

    /** Fetches a repository from SourceHut. **Pass either a tag or a commit, not both.***/
    static fetchFromSourceHut({owner, repo, tag, commit} : SourceHutOptions) : Path{
        onlyTagOrCommit(`${owner}/${repo}`, tag, commit)
        // SourceHut user names start with `~`.
        const user = owner.startsWith("~") ? owner : `~${owner}`
        return Path.#input(hostedUrl("sourcehut", user, repo, tag ?? commit), repo)
    }

    /** Where `path` points, for the compiler. */
    static locationOf(path: Path): PathLocation {
        return path.#location
    }

    static #at(location: PathLocation): Path {
        const p = new Path()
        p.#location = location
        return p
    }

    static #input(url: string, suggestedName: string): Path {
        return Path.#at({ kind: "input", url, suggestedName })
    }
}

/** Where a `Path` points. The compiler reads it with `Path.locationOf`. */
export type PathLocation =
    /** Inside the project, relative to `flake.ts`: written as a path, e.g. `./src`. */
    | { kind: "local"; path: string }
    /** Fetched by the flake: one of its `inputs`, with this flake reference. */
    | { kind: "input"; url: string; suggestedName: string }
    /** `subpath` (names separated by `/`, without `.` or `..`) inside `parent`. */
    | { kind: "sub"; parent: Path; subpath: string }

function onlyTagOrCommit(what: string, tag: string | undefined, commit: string | undefined): void {
    if (tag !== undefined && commit !== undefined)
        throw new NixtyError(`On Path ${what}: pass either a tag or a commit, not both.`)
}

/** `github:owner/repo/ref`, the flake reference of a hosted repository. */
function hostedUrl(host: string, owner: string, repo: string, ref: string | undefined): string {
    return ref === undefined ? `${host}:${owner}/${repo}` : `${host}:${owner}/${repo}/${ref}`
}

/** `git+https://...`: the fetcher goes before the URL's scheme, unless it's already there. */
function withScheme(fetcher: string, url: string): string {
    return url.startsWith(`${fetcher}+`) ? url : `${fetcher}+${url}`
}

/** Utility function to add a query section to a url string */
function withQuery(url: string, query: URLSearchParams): string {
    const text = query.toString()
    if (text === "") return url
    return url.includes("?") ? `${url}&${text}` : `${url}?${text}`
}

/** The last name in a URL or path, without a known extension: `https://x.org/app-1.0.tar.gz` -> `app-1.0`. */
function lastName(url: string): string {
    const names = url.split("?")[0].split("/").filter((name) => name !== "")
    const last = names[names.length - 1] ?? "source"
    return last.replace(/\.(git|tar\.gz|tar\.xz|tar\.bz2|tar\.zst|tgz|tar|zip)$/, "")
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
    /** `<fn> <arg> <arg> ...`. When it's used more than once it's bound with `let`, under
     *  `suggestedName` if there is one (calling once is cheaper than calling at every use). */
    | { kind: "call"; fn: Expresion; args: NixArg[]; suggestedName: string | null }

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
            call: (self: Expresion, args) => Expresion.namedCall(self, args as NixArg[], null),
        })
        this.#step = source instanceof Path ? { kind: "import", path: source } : source
    }

    /** The attribute `name`, for names `expr.name` can't reach: numbers and `RESERVED` names. */
    static attr(expr: Expresion, name: string): Expresion {
        return expr.#child(name)
    }

    /** `fn(...args)`, with the name to give the result if it's bound with `let`, e.g. `"pkgs"`. */
    static namedCall(fn: Expresion, args: NixArg[], suggestedName: string | null): Expresion {
        return Expresion.#derive({ kind: "call", fn, args, suggestedName })
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

    /** The path `source` was made from, for the compiler. */
    static pathOf(source: Source): Path {
        return source.#path
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

    /** Creates a Derivation explicitly. `name` must match `VALID_NAME`. */
    static fromDefinition(name: string, system: System, definition: DerivationDefinition) : Derivation{
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
    
    /** Creates a Derivation from an Expresion, `suggestedName` names it in the generated code if it's used more than once (`let <name> = ...`). */
    static fromExpresion(system: System, expr: Expresion, suggestedName?: string) : Derivation {
        const d = new Derivation()
        d.#kind = DerivationKind.EXTERNAL
        d.#system = system
        d.#expresion = expr
        d.#name = suggestedName ? suggestedName : null
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
    
    /** The name given to `fromDefinition`, or suggested to `fromExpresion` (`null` if none was). */
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
    
    /** Everything `d` was made from, for the compiler. */
    static partsOf(d: Derivation): DerivationParts {
        return {
            kind: d.#kind,
            name: d.#name,
            system: d.#system,
            expresion: d.#expresion,
            definition: d.#definition,
        }
    }
}

/** What `Derivation.partsOf` returns. An INTERNAL derivation has a `definition`, an EXTERNAL one an
 *  `expresion`. */
export interface DerivationParts {
    kind: DerivationKind
    name: string | null
    system: System | null
    expresion: Expresion | null
    definition: DerivationDefinition | null
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
