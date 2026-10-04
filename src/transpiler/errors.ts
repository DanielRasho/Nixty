/**
 * An error caused by the user's flake definition (as opposed to a bug in nixty). The CLI prints its
 * message without a stack trace.
 */
export class NixtyError extends Error {
  override name = "NixtyError";
}
