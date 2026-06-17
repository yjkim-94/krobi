import { describe, expect, it } from "vitest";
import type { SpeciesDef } from "./types";
import type { AppData } from "./appData";
import krombiSpecies from "../assets/pets/krombi/species.json";
import { migrateAppData } from "./appData";
import { applyTickAll, evolveSpecies, resetSpecies, acquireSpecies, addSlot, hideSlot, setDisplayForm, feedSpecies } from "./appDataOps";

const krombi = krombiSpecies as SpeciesDef;

function withTwoSpecies(): AppData {
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

describe("acquireSpecies", () => {
  it("adds a new species at stage1, unowned -> owned", () => {
    const data = migrateAppData(undefined, krombi); // krombi only
    const next = acquireSpecies(data, "mochi");
    expect(next.pets.mochi.unlockedForms).toEqual(["stage1"]);
    expect(next.pets.mochi.instance.form).toBe("stage1");
    expect(next.slots).toEqual(data.slots); // acquiring does not display it
  });

  it("is a no-op if already owned", () => {
    const data = withTwoSpecies();
    expect(acquireSpecies(data, "mochi")).toEqual(data);
  });
});

describe("addSlot", () => {
  it("adds an owned, not-yet-shown species to slots", () => {
    const data = withTwoSpecies(); // mochi owned but hidden
    const next = addSlot(data, "mochi");
    expect(next.slots).toEqual([
      { speciesId: "krombi", displayForm: "stage1" },
      { speciesId: "mochi", displayForm: "stage1" },
    ]);
  });

  it("is a no-op if the species is unowned", () => {
    const data = migrateAppData(undefined, krombi); // mochi not owned
    expect(addSlot(data, "mochi")).toEqual(data);
  });

  it("is a no-op if the species is already shown", () => {
    const data = withTwoSpecies();
    expect(addSlot(data, "krombi")).toEqual(data);
  });
});

describe("hideSlot", () => {
  it("removes a slot when more than one is shown", () => {
    const data = addSlot(withTwoSpecies(), "mochi");
    const next = hideSlot(data, "mochi");
    expect(next.slots).toEqual([{ speciesId: "krombi", displayForm: "stage1" }]);
  });

  it("is a no-op when it would leave slots empty", () => {
    const data = migrateAppData(undefined, krombi); // only krombi shown
    expect(hideSlot(data, "krombi")).toEqual(data);
  });
});

describe("setDisplayForm", () => {
  it("changes a slot's displayForm without touching the instance", () => {
    const base = withTwoSpecies();
    const data = {
      ...base,
      pets: {
        ...base.pets,
        krombi: { unlockedForms: ["stage1", "stage2-sage", "stage3-sage"], instance: { ...base.pets.krombi.instance, form: "stage3-sage" } },
      },
    };
    const next = setDisplayForm(data, "krombi", "stage1");
    expect(next.slots[0]).toEqual({ speciesId: "krombi", displayForm: "stage1" });
    expect(next.pets.krombi.instance.form).toBe("stage3-sage"); // progress unaffected
  });

  it("is a no-op if the form was never unlocked", () => {
    const data = withTwoSpecies();
    expect(setDisplayForm(data, "krombi", "stage3-wild")).toEqual(data);
  });

  it("is a no-op if the species has no active slot", () => {
    const data = withTwoSpecies(); // mochi owned but not in slots
    expect(setDisplayForm(data, "mochi", "stage1")).toEqual(data);
  });
});

describe("feedSpecies", () => {
  it("increases satiety by the given amount", () => {
    const data = withTwoSpecies();
    const lowered = {
      ...data,
      pets: { ...data.pets, krombi: { ...data.pets.krombi, instance: { ...data.pets.krombi.instance, status: { satiety: 50 } } } },
    };
    const next = feedSpecies(lowered, "krombi", 20);
    expect(next.pets.krombi.instance.status.satiety).toBe(70);
  });

  it("clamps satiety at 100", () => {
    const data = withTwoSpecies();
    const next = feedSpecies(data, "krombi", 20); // starts at 100 via defaultPet()
    expect(next.pets.krombi.instance.status.satiety).toBe(100);
  });

  it("defaults amount to 20", () => {
    const data = withTwoSpecies();
    const lowered = {
      ...data,
      pets: { ...data.pets, krombi: { ...data.pets.krombi, instance: { ...data.pets.krombi.instance, status: { satiety: 50 } } } },
    };
    const next = feedSpecies(lowered, "krombi");
    expect(next.pets.krombi.instance.status.satiety).toBe(70);
  });

  it("is a no-op for an unowned species", () => {
    const data = withTwoSpecies();
    expect(feedSpecies(data, "nope")).toEqual(data);
  });
});
