import { describe, expect, it } from "vitest";
import { speciesFormAsset } from "./speciesFormAssets";

describe("speciesFormAsset", () => {
  it("finds krombi's stage1 manifest and sheet", () => {
    const asset = speciesFormAsset("krombi", "stage1");
    expect(asset?.manifest.id).toBe("krombi/stage1");
    expect(asset?.sheetUrl).toBeTruthy();
  });

  it("finds mochi's stage2-sage manifest and sheet", () => {
    const asset = speciesFormAsset("mochi", "stage2-sage");
    expect(asset?.manifest.id).toBe("mochi/stage2-sage");
    expect(asset?.sheetUrl).toBeTruthy();
  });

  it("returns null for an unknown species", () => {
    expect(speciesFormAsset("nope", "stage1")).toBeNull();
  });

  it("returns null for an unknown form of a known species", () => {
    expect(speciesFormAsset("krombi", "stage9")).toBeNull();
  });
});
