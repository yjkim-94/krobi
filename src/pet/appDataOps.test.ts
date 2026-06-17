import { describe, expect, it } from "vitest";
import type { SpeciesDef } from "./types";
import krombiSpecies from "../assets/pets/krombi/species.json";
import { migrateAppData } from "./appData";
import { applyTickAll, evolveSpecies, resetSpecies } from "./appDataOps";

const krombi = krombiSpecies as SpeciesDef;

function withTwoSpecies() {
  const data = migrateAppData(undefined, krombi); // krombi owned + slotted
  return {
    ...data,
    pets: {
      ...data.pets,
      mochi: { unlockedForms: ["stage1"], instance: { ...data.pets.krombi.instance } },
    },
    // mochi NOT in slots -> hidden
  };
}

describe("applyTickAll", () => {
  it("ticks only species currently in slots", () => {
    const data = withTwoSpecies();
    const next = applyTickAll(data, { satietyRate: 1, expGain: 10 });
    expect(next.pets.krombi.instance.exp).toBe(10); // slotted -> ticked
    expect(next.pets.mochi.instance.exp).toBe(0); // hidden -> untouched
  });
});

describe("evolveSpecies", () => {
  it("advances form, resets exp, and records the new unlock", () => {
    const data = withTwoSpecies();
    const ready = {
      ...data,
      pets: {
        ...data.pets,
        krombi: {
          unlockedForms: ["stage1"],
          instance: { ...data.pets.krombi.instance, exp: 150, tendencies: { maker: 5, sage: 1, wild: 1 } },
        },
      },
    };
    const next = evolveSpecies(ready, "krombi", krombi);
    expect(next.pets.krombi.instance.form).toBe("stage2-maker");
    expect(next.pets.krombi.instance.exp).toBe(0);
    expect(next.pets.krombi.unlockedForms).toEqual(["stage1", "stage2-maker"]);
  });

  it("is a no-op when not eligible", () => {
    const data = withTwoSpecies();
    expect(evolveSpecies(data, "krombi", krombi)).toEqual(data);
  });

  it("is a no-op for an unowned species", () => {
    const data = withTwoSpecies();
    expect(evolveSpecies(data, "nope", krombi)).toEqual(data);
  });
});

describe("resetSpecies", () => {
  it("returns the instance to stage1/exp0/zero-tendencies but keeps unlockedForms", () => {
    const data = withTwoSpecies();
    const grown = {
      ...data,
      pets: {
        ...data.pets,
        krombi: {
          unlockedForms: ["stage1", "stage2-sage", "stage3-sage"],
          instance: { ...data.pets.krombi.instance, form: "stage3-sage", exp: 50, tendencies: { maker: 1, sage: 9, wild: 0 } },
        },
      },
    };
    const next = resetSpecies(grown, "krombi");
    expect(next.pets.krombi.instance.form).toBe("stage1");
    expect(next.pets.krombi.instance.exp).toBe(0);
    expect(next.pets.krombi.instance.tendencies).toEqual({ maker: 0, sage: 0, wild: 0 });
    expect(next.pets.krombi.unlockedForms).toEqual(["stage1", "stage2-sage", "stage3-sage"]);
  });

  it("is a no-op for an unowned species", () => {
    const data = withTwoSpecies();
    expect(resetSpecies(data, "nope")).toEqual(data);
  });
});
