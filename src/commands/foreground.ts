// Running another program in this terminal, as if the user had started it themselves.
import { spawn } from "node:child_process"
import { constants } from "node:os"

/** Signals the terminal sends to every process in it (Ctrl+C, Ctrl+\). */
const TERMINAL_SIGNALS = ["SIGINT", "SIGQUIT"] as const

/**
 * Runs `command` with this terminal and resolves with its exit code.
 *
 * Ctrl+C reaches both this process and the child. Node exits on it by default, which would leave the
 * child (e.g. the shell of `nix develop`) running on its own, so while the child runs those signals
 * are ignored here and the child decides what they do.
 */
export function runInForeground(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
    const ignore = (): void => {}
    for (const signal of TERMINAL_SIGNALS) process.on(signal, ignore)
    const stopIgnoring = (): void => {
        for (const signal of TERMINAL_SIGNALS) process.off(signal, ignore)
    }

    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: "inherit", env })
        child.on("error", (error) => {
            stopIgnoring()
            reject(error)
        })
        child.on("close", (code, signal) => {
            stopIgnoring()
            // Killed by a signal: the shell convention, 128 + its number (130 for Ctrl+C).
            resolve(code ?? (signal === null ? 1 : 128 + constants.signals[signal]))
        })
    })
}
