import { describe, expect, it } from "vitest";
import { formAppearance } from "./formAppearance";

describe("formAppearance", () => {
  it("stage1 has no tint and scale 1", () => {
    const a = formAppearance("stage1");
    expect(a.filter).toBe("none");
    expect(a.scale).toBe(1);
  });
  it("stage2 branches get a non-none filter and a >1 scale", () => {
    const a = formAppearance("stage2-maker");
    expect(a.filter).not.toBe("none");
    expect(a.scale).toBeGreaterThan(1);
  });
  it("stage3 is larger than stage2", () => {
    expect(formAppearance("stage3-wild").scale).toBeGreaterThan(
      formAppearance("stage2-wild").scale,
    );
  });
  it("different branches get different filters", () => {
    expect(formAppearance("stage2-maker").filter).not.toBe(
      formAppearance("stage2-sage").filter,
    );
  });
});
