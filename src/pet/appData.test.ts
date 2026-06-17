import { describe, expect, it } from "vitest";
import type { SpeciesDef } from "./types";
import krombiSpecies from "../assets/pets/krombi/species.json";
import { unlockChain, migrateAppData } from "./appData";

const krombi = krombiSpecies as SpeciesDef;

describe("unlockChain", () => {
  it("returns just stage1 for stage1", () => {
    expect(unlockChain(krombi, "stage1")).toEqual(["stage1"]);
  });

  it("walks the from-chain back to stage1 for a stage3 form", () => {
    expect(unlockChain(krombi, "stage3-sage")).toEqual(["stage1", "stage2-sage", "stage3-sage"]);
  });

  it("walks one step for a stage2 form", () => {
    expect(unlockChain(krombi, "stage2-wild")).toEqual(["stage1", "stage2-wild"]);
  });
});

describe("migrateAppData", () => {
  it("builds a fresh-install AppData when there is no saved data", () => {
    const data = migrateAppData(undefined, krombi);
    expect(Object.keys(data.pets)).toEqual(["krombi"]);
    expect(data.pets.krombi.unlockedForms).toEqual(["stage1"]);
    expect(data.pets.krombi.instance.form).toBe("stage1");
    expect(data.slots).toEqual([{ speciesId: "krombi", displayForm: "stage1" }]);
  });

  it("converts a legacy single-pet save into the krombi entry", () => {
    const legacy = {
      pet: {
        form: "stage3-sage",
        status: { satiety: 80 },
        exp: 0,
        tendencies: { maker: 1, sage: 9, wild: 1 },
        unknownApps: {},
        last_updated: "2026-01-01T00:00:00.000Z",
      },
    };
    const data = migrateAppData(legacy, krombi);
    expect(data.pets.krombi.unlockedForms).toEqual(["stage1", "stage2-sage", "stage3-sage"]);
    expect(data.pets.krombi.instance.form).toBe("stage3-sage");
    expect(data.pets.krombi.instance.status.satiety).toBe(80);
    expect(data.slots).toEqual([{ speciesId: "krombi", displayForm: "stage3-sage" }]);
  });

  it("returns already-migrated data unchanged", () => {
    const migrated = {
      pets: { mochi: { unlockedForms: ["stage1"], instance: { form: "stage1", status: { satiety: 50 }, exp: 0, tendencies: { maker: 0, sage: 0, wild: 0 }, unknownApps: {}, last_updated: "t" } } },
      slots: [{ speciesId: "mochi", displayForm: "stage1" }],
    };
    expect(migrateAppData(migrated, krombi)).toEqual(migrated);
  });
});
