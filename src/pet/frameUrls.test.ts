import { describe, expect, it } from "vitest";
import { krobiFrameUrls } from "./frameUrls";
import manifestJson from "../assets/pets/krobi/stage1/manifest.json";
import type { PetManifest } from "./types";

const manifest = manifestJson as PetManifest;

describe("krobiFrameUrls", () => {
  it("loads every frame referenced by the krobi stage1 manifest", () => {
    const referenced = new Set(
      Object.values(manifest.animations).flatMap((a) => a.frames),
    );
    expect(referenced.size).toBeGreaterThan(0);
    for (const name of referenced) {
      expect(krobiFrameUrls[name], name).toBeTruthy();
    }
  });
});
