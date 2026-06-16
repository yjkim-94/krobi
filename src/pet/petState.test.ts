import { describe, expect, it } from "vitest";
import type { SpeciesDef } from "./types";
import krombiSpecies from "../assets/pets/krombi/species.json";
import {
  defaultPet,
  migrate,
  applyTick,
  dominantTendency,
  canEvolve,
  resolveNextForm,
  applyEvolution,
} from "./petState";

const species = krombiSpecies as SpeciesDef;

describe("migrate", () => {
  it("returns a default stage1 pet for empty input", () => {
    const p = migrate(undefined);
    expect(p.form).toBe("stage1");
    expect(p.exp).toBe(0);
    expect(p.tendencies).toEqual({ maker: 0, sage: 0, wild: 0 });
    expect(p.status.satiety).toBe(100);
  });

  it("carries old satiety/hunger and drops legacy level", () => {
    const p = migrate({ name: "x", level: 3, status: { hunger: 42 }, last_updated: "t" });
    expect(p.name).toBe("x");
    expect(p.status.satiety).toBe(42);
    expect(p.form).toBe("stage1");
  });
});

describe("applyTick", () => {
  it("decrements satiety and increments exp by the given rates", () => {
    const base = defaultPet();
    const next = applyTick(base, { satietyRate: 1, expGain: 10 });
    expect(next.status.satiety).toBe(99);
    expect(next.exp).toBe(10);
  });

  it("clamps satiety at 0", () => {
    const p = { ...defaultPet(), status: { satiety: 0 } };
    expect(applyTick(p, { satietyRate: 5, expGain: 0 }).status.satiety).toBe(0);
  });
});

describe("dominantTendency", () => {
  it("picks the max tendency", () => {
    expect(dominantTendency({ maker: 1, sage: 9, wild: 3 })).toBe("sage");
  });
  it("defaults to maker on an all-zero tie", () => {
    expect(dominantTendency({ maker: 0, sage: 0, wild: 0 })).toBe("maker");
  });
});

describe("canEvolve", () => {
  it("true when exp reaches the form threshold", () => {
    expect(canEvolve(species, "stage1", 100)).toBe(true);
    expect(canEvolve(species, "stage1", 99)).toBe(false);
  });
  it("false for terminal stage3 forms", () => {
    expect(canEvolve(species, "stage3-maker", 9999)).toBe(false);
  });
});

describe("resolveNextForm", () => {
  it("stage1 evolves toward the dominant tendency", () => {
    const pet = { ...defaultPet(), exp: 100, tendencies: { maker: 2, sage: 9, wild: 1 } };
    expect(resolveNextForm(species, pet)).toBe("stage2-sage");
  });
  it("stage2 evolves to stage3 of the same branch", () => {
    const pet = { ...defaultPet(), form: "stage2-wild", exp: 300 };
    expect(resolveNextForm(species, pet)).toBe("stage3-wild");
  });
  it("returns null for a terminal form", () => {
    const pet = { ...defaultPet(), form: "stage3-wild", exp: 9999 };
    expect(resolveNextForm(species, pet)).toBeNull();
  });
});

describe("applyEvolution", () => {
  it("advances form and resets exp when eligible", () => {
    const pet = { ...defaultPet(), exp: 150, tendencies: { maker: 5, sage: 1, wild: 1 } };
    const next = applyEvolution(species, pet);
    expect(next.form).toBe("stage2-maker");
    expect(next.exp).toBe(0);
  });
  it("is a no-op when not eligible", () => {
    const pet = { ...defaultPet(), exp: 10 };
    expect(applyEvolution(species, pet)).toEqual(pet);
  });
});
