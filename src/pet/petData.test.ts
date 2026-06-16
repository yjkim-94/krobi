import { describe, expect, it } from "vitest";
import type { Catalog, SpeciesDef } from "./types";
import catalog from "../assets/pets/catalog.json";
import krobiSpecies from "../assets/pets/krobi/species.json";

const cat = catalog as Catalog;
const krobi = krobiSpecies as SpeciesDef;

describe("catalog.json", () => {
  it("has a well-formed krobi entry", () => {
    const entry = cat.species.find((s) => s.id === "krobi");
    expect(entry).toBeDefined();
    expect(entry!.archetype).toBe("slime");
    expect(entry!.branches).toHaveLength(3);
  });
});

describe("krobi species.json", () => {
  it("declares archetype + 3-branch whitelist matching the catalog", () => {
    const entry = cat.species.find((s) => s.id === "krobi")!;
    expect(krobi.archetype).toBe("slime");
    expect(krobi.branchWhitelist).toHaveLength(3);
    expect([...krobi.branchWhitelist].sort()).toEqual([...entry.branches].sort());
  });

  it("has a real stage1 form with frameSize 64", () => {
    expect(krobi.forms.stage1).toBeDefined();
    expect(krobi.forms.stage1.frameSize).toBe(64);
    expect(krobi.forms.stage1.from).toBeUndefined();
  });

  it("every non-stage1 form has a parent and an abstract condition", () => {
    for (const [key, form] of Object.entries(krobi.forms)) {
      if (key === "stage1") continue;
      expect(form.from, `${key}.from`).toBeTruthy();
      expect(form.condition?.stat, `${key}.condition.stat`).toBeTruthy();
    }
  });
});
