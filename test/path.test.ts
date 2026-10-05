import { describe, expect, it } from "vitest"
import { Path } from "../src/compiler/api/primitives.js"
import { NixtyError } from "../src/compiler/errors.js"

describe("Path", () => {
    it("builds the flake reference of each fetcher", () => {
        const urls = [
            Path.fetchFromGithub({ owner: "NixOS", repo: "nixpkgs", tag: "nixos-25.05" }),
            Path.fetchFromGitLab({ owner: "me", repo: "app", commit: "abc123" }),
            Path.fetchFromSourceHut({ owner: "me", repo: "app" }),
            Path.fetchFromGit({ url: "https://example.com/app.git", submodules: true, tag: "v1" }),
            Path.fetchFromMercurial({ url: "https://example.com/app", commit: "abc" }),
            Path.fetchFromTarball({ url: "https://example.com/app-1.0.tar.gz" }),
            Path.fetchExternalPath("/etc/app"),
        ].map((p) => Path.locationOf(p))
        expect(urls).toEqual([
            { kind: "input", url: "github:NixOS/nixpkgs/nixos-25.05", suggestedName: "nixpkgs" },
            { kind: "input", url: "gitlab:me/app/abc123", suggestedName: "app" },
            { kind: "input", url: "sourcehut:~me/app", suggestedName: "app" },
            { kind: "input", url: "git+https://example.com/app.git?ref=v1&submodules=1", suggestedName: "app" },
            { kind: "input", url: "hg+https://example.com/app?rev=abc", suggestedName: "app" },
            { kind: "input", url: "tarball+https://example.com/app-1.0.tar.gz", suggestedName: "app-1.0" },
            { kind: "input", url: "path:/etc/app", suggestedName: "app" },
        ])
    })

    it("rejects a tag and a commit together", () => {
        expect(() => Path.fetchFromGithub({ owner: "me", repo: "app", tag: "v1", commit: "abc" })).toThrow(NixtyError)
    })

    it("keeps project paths inside the project", () => {
        expect(() => Path.fetchInternalPath("/etc")).toThrow(NixtyError)
        expect(() => Path.fetchInternalPath("../x")).toThrow(NixtyError)
        expect(() => Path.fetchExternalPath("etc")).toThrow(NixtyError)
        expect(() => Path.fetchInternalPath(".").subPath("../x")).toThrow(NixtyError)
    })
})
