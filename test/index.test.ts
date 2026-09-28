import { describe, expect, it } from "vitest";
import { add, addPoints, type Point } from "../src/index.js";

describe("mockup exports", () => {
  it("add sums two numbers", () => {
    expect(add(2, 3)).toBe(5);
  });

  it("addPoints sums component-wise", () => {
    const a: Point = { x: 1, y: 2 };
    const b: Point = { x: 10, y: 20 };
    expect(addPoints(a, b)).toEqual({ x: 11, y: 22 });
  });
});
