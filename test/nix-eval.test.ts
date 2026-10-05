// Evaluates generated flakes with the real `nix` against a stub nixpkgs, to check the output is valid
// Nix that means what we intend. Skipped when nix isn't installed; nothing is built or downloaded.
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { compile } from "nixty-lib/compiler"
import compile01 from "./cases/compile01.js"

const hasNix = spawnSync("nix-instantiate", ["--version"]).status === 0

// What `import nixpkgs { system; config; }` gives: just enough to read the outputs back.
const STUB_NIXPKGS = `
{ system, config }:
{
  nodejs_22 = "nodejs_22"; go = "go"; vitest = "vitest"; gopls = "gopls";
  makeWrapper = "makeWrapper";
  stdenv.mkDerivation = a: a // { inherit system config; outPath = "/nix/store/\${a.pname}"; };
  mkShell = a: a;
  writeText = name: text: "/nix/store/\${name}";
  writeShellApplication = a: a;
  lib = {
    makeBinPath = l: builtins.concatStringsSep ":" (map (p: "\${p}/bin") l);
    licenses.mit = "mit";
    # Gives back the script itself, so tests can read what the command runs.
    getExe = d: builtins.toJSON { inherit (d) name text runtimeInputs; };
    escapeShellArg = s: "'\${s}'";
  };
}
`

const STUB_TOOLS = `{ packages.x86_64-linux.cli = "cli"; packages.aarch64-linux.cli = "cli"; }`

/** Evaluates `expr` with `self` bound to the flake's outputs. */
function evaluate(flakeNix: string, expr: string): unknown {
    const dir = mkdtempSync(join(tmpdir(), "nixty-eval-"))
    writeFileSync(join(dir, "flake.nix"), flakeNix)
    mkdirSync(join(dir, "nixpkgs"))
    writeFileSync(join(dir, "nixpkgs", "default.nix"), STUB_NIXPKGS)
    writeFileSync(
        join(dir, "eval.nix"),
        `let self = (import ./flake.nix).outputs { inherit self; nixpkgs = ./nixpkgs; tools = ${STUB_TOOLS}; }; in ${expr}`,
    )
    const result = spawnSync("nix-instantiate", ["--eval", "--strict", "--json", join(dir, "eval.nix")], {
        encoding: "utf8",
    })
    if (result.status !== 0) throw new Error(result.stderr)
    return JSON.parse(result.stdout)
}

describe.skipIf(!hasNix)("compile01 evaluates", () => {
    const flakeNix = compile(compile01)

    it("builds the package with its phases and deps", () => {
        const p = evaluate(
            flakeNix,
            `{ inherit (self.packages.x86_64-linux.WeatherCLI)
                 system config buildPhase installPhase postFixup nativeBuildInputs doCheck meta; }`,
        )
        expect(p).toEqual({
            system: "x86_64-linux",
            config: { allowUnfree: true },
            buildPhase: "npm run build -- --config /nix/store/weather-config",
            installPhase: "mkdir -p $out/bin\ncp dist/weather $out/bin/",
            postFixup: 'for f in "$out"/bin/*; do\n  wrapProgram "$f" --prefix PATH : nodejs_22/bin\ndone',
            nativeBuildInputs: ["nodejs_22", "makeWrapper"],
            doCheck: true,
            meta: { description: "Tells the weather of a city", license: "mit", mainProgram: "weather" },
        })
    })

    it("uses per-system values", () => {
        expect(evaluate(flakeNix, "self.packages.aarch64-linux.WeatherCLI.buildInputs")).toEqual(["go"])
        expect(evaluate(flakeNix, "self.packages.x86_64-linux.WeatherCLI ? buildInputs")).toBe(false)
    })

    it("puts the package itself and other flakes' packages in a shell", () => {
        const shell = evaluate(flakeNix, "let s = self.devShells.x86_64-linux.QA; in s // { packages = map (p: p.pname or p) s.packages; }")
        expect(shell).toEqual({
            name: "QA",
            packages: ["nodejs_22", "go", "cli", "WeatherCLI"],
            env: { HELLO: "THERE WE GO" },
            shellHook: 'echo "QA shell"',
        })
    })

    it("writes the command's script", () => {
        const app = evaluate(flakeNix, "self.apps.x86_64-linux.test") as Record<string, string>
        expect(app["type"]).toBe("app")
        expect(JSON.parse(app["program"])).toEqual({
            name: "test",
            text: "export CI='1'\nnpm test\n",
            runtimeInputs: ["nodejs_22"],
        })
    })
})
