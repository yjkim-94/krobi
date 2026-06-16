import { describe, expect, it } from "vitest";
import { krombiSheetUrl } from "./frameUrls";
import manifestJson from "../assets/pets/krombi/stage1/manifest.json";
import type { PetManifest } from "./types";

const manifest = manifestJson as PetManifest;

describe("krombi stage1 sheet", () => {
  it("imports the sprite sheet asset", () => {
    expect(krombiSheetUrl).toBeTruthy();
  });

  it("manifest is sheet-based with valid cell indices", () => {
    expect(manifest.sheet).toBe("sheet.png");
    expect(manifest.columns).toBeGreaterThan(0);
    const cells = Object.values(manifest.animations).flatMap((a) => a.frames);
    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) {
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
    }
  });
});
