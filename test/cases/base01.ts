const n = require("nixty")
let {ARM_64, X86} = n.architectures
let {MIT} = n.Licenses

// PROJECT
const D = new n.Definition("A definition for this project");

// Registries
const nixPackages = new n.Registry("URL");
const home = new n.Registry("URL");

// Architectures
const ARCHITECTURES = [X86, ARM_64]

// =====================
//     DEV ENVS
// =====================

let QAEnv = n.devEnv({
    name: "QA",
    description: "Environment for tests",
    architectures: ARCHITECTURES,
    packages: n.ForAllArchitectures( (self: DevEnv) => {
        self.install("node",  "v1", nixPackages)
        self.install("go",    "v1", nixPackages)
        self.install("vitejs","v1", nixPackages)
    })
})

let ProdEnv = n.devEnv({
    name: "Prod",
    description: "Prod environment",
    architectures: ARCHITECTURES,
    packages: (self: DevEnv, arch: Architecture) => {
        if (arch == ARM_64) {
            self.install(new n.P("node",  "v1", nixPackages))
            self.install(new n.P("go",  "v1", nixPackages))
            self.install(new n.P("vite",  "v1", nixPackages))
            self.install(mainPackages)
        }
        else {
            self.install("node",  "v2", home)
            self.install("go",    "v1", home)
            self.install("vitejs","v1", home)
        }
    } 
})
D.DevEnvironments([QAEnv, ProdEnv])

// =====================
//     PACKAGES
// =====================

const mainPackages = n.utils.each([
    [ARM_64, "github.com/DanielRasho/Nixty-x86"], 
    [X86, "github.com/DanielRasho/Nixty-x86"]
], (arch, src) => {
    return n.Package({
        name: "Hello",
        version : "v1.0",
        description: "A package to say hello to anyone",
        architecture: arch,
        license : MIT,
        src: n.source.github(src),
        dependencies: (self: DevEnv) => {
            if (arch == ARM_64) {
                // architecture is configured in teh background
                self.add("node",  "v1", nixPackages) 
                self.add("go",    "v1", nixPackages)
                self.add("vitejs","v1", nixPackages)
            }
            else {
                self.add("node",  "v2", nixPackages)
                self.add("go",    "v1", nixPackages)
                self.add("vitejs","v1", nixPackages)
            }
        } 
        phases: (arch, out) => {
            if (arch = X86) 
                return {
                    build: `npm ${out}/bin build`,
                    install : "npm install"
                }
            else
                return {
                    build: "hello world",
                    install : "npm install"
                }
        },
    })
})

D.Packages(...mainPackage)

export default D;