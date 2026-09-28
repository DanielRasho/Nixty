// Public DSL surface. Builders (flake(), pkgs(), ...) land here as they're implemented.
//
// The exports below are temporary mockups used to verify the package can be built,
// packed, installed and imported from another project. Remove once real builders land.

/** A plain struct-like type, used to verify that types are exported and resolvable. */
export interface Point {
  x: number;
  y: number;
}

/** Adds two numbers. */
export function add(a: number, b: number): number {
  return a + b;
}

/** Adds two points component-wise. */
export function addPoints(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}
