import { describe, expect, it } from "vitest"
import { Definition, Nixpkgs, Package, Path, Source, System } from "nixty-lib"
import { compile } from "nixty-lib/compiler"
import compile01 from "../cases/compile01.js"
import weathercli from "../cases/weathercli.js"

describe("compile01", () => {
    it("matches the golden flake.nix", async () => {
        await expect(compile(compile01)).toMatchFileSnapshot("./cases/compile01.nix")
    })

    it("leaves out inputs nothing reaches", () => {
        expect(compile(compile01)).not.toContain("github:me/unused")
    })
})

describe("weathercli", () => {
    it("matches the golden flake.nix", async () => {
        await expect(compile(weathercli)).toMatchFileSnapshot("./cases/weathercli.nix")
    })
})

describe("compile", () => {
    it("rejects a package from another system", () => {
        const NIX_PKGS = new Nixpkgs({ tag: "nixos-25.05" })
        const p = new Package("p", [System.x86_64Linux, System.aarch64Linux], () => ({
            version: "1.0",
            src: new Source(Path.fetchInternalPath(".")),
            // A fixed system instead of the one the recipe receives.
            deps: { atBuild: NIX_PKGS.getPackages(["go"], System.x86_64Linux) },
            phases: () => ({}),
        }))
        const definition = new Definition({ description: "", nixpkgs: NIX_PKGS, packages: [p] })
        expect(() => compile(definition)).toThrow(/packages\.p \(aarch64-linux\) uses a value made for x86_64-linux/)
    })
})
