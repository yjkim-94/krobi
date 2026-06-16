import { describe, it, expect } from "vitest";
import { exceededThreshold } from "./dragMath";

describe("exceededThreshold", () => {
  it("false inside the radius (treated as a click)", () => {
    expect(exceededThreshold(2, 2, 4)).toBe(false); // hypot≈2.83
  });
  it("true once movement exceeds the radius (treated as a drag)", () => {
    expect(exceededThreshold(5, 0, 4)).toBe(true);
    expect(exceededThreshold(-3, -4, 4)).toBe(true); // hypot=5
  });
});
