import { describe, expect, it } from "vitest";
import { getSpeciesDef, allSpeciesIds } from "./speciesRegistry";

describe("speciesRegistry", () => {
  it("finds krombi and mochi species defs", () => {
    expect(getSpeciesDef("krombi")?.archetype).toBe("slime");
    expect(getSpeciesDef("mochi")?.archetype).toBe("beast");
  });

  it("returns undefined for an unknown species id", () => {
    expect(getSpeciesDef("nope")).toBeUndefined();
  });

  it("lists all known species ids, including krombi and mochi", () => {
    const ids = allSpeciesIds();
    expect(ids).toContain("krombi");
    expect(ids).toContain("mochi");
  });
});
