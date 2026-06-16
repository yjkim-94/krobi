import { describe, expect, it } from "vitest";
import type { Catalog, SpeciesDef } from "./types";
import catalog from "../assets/pets/catalog.json";
import krombiSpecies from "../assets/pets/krombi/species.json";

const cat = catalog as Catalog;
const krombi = krombiSpecies as SpeciesDef;

describe("catalog.json", () => {
  it("has a well-formed krombi entry", () => {
    const entry = cat.species.find((s) => s.id === "krombi");
    expect(entry).toBeDefined();
    expect(entry!.archetype).toBe("slime");
    expect(entry!.branches).toHaveLength(3);
  });
});

describe("krombi species.json", () => {
  it("declares 3 branches matching the catalog", () => {
    const entry = cat.species.find((s) => s.id === "krombi")!;
    expect(krombi.archetype).toBe("slime");
    expect(Object.keys(krombi.branches).sort()).toEqual([...entry.branches].sort());
  });

  it("stage1 has frameSize 64, an expToEvolve, no parent/branch", () => {
    const s1 = krombi.forms.stage1;
    expect(s1.frameSize).toBe(64);
    expect(s1.from).toBeUndefined();
    expect(s1.branch).toBeUndefined();
    expect(s1.expToEvolve).toBeGreaterThan(0);
  });

  it("every stage2 form has from=stage1, a known branch, and an expToEvolve", () => {
    for (const key of ["stage2-maker", "stage2-sage", "stage2-wild"]) {
      const f = krombi.forms[key];
      expect(f.from).toBe("stage1");
      expect(krombi.branches[f.branch!]).toBeDefined();
      expect(f.expToEvolve).toBeGreaterThan(0);
    }
  });

  it("stage3 forms are terminal (no expToEvolve)", () => {
    for (const key of ["stage3-maker", "stage3-sage", "stage3-wild"]) {
      const f = krombi.forms[key];
      expect(f.from).toBe(`stage2-${f.branch}`);
      expect(f.expToEvolve).toBeUndefined();
    }
  });
});
