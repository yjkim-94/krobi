import { describe, expect, it } from "vitest";
import { krobiFrameUrls } from "./frameUrls";

describe("krobiFrameUrls", () => {
  it("loads all 12 krobi frames keyed by base name", () => {
    const keys = Object.keys(krobiFrameUrls);
    expect(keys).toHaveLength(12);
    for (const name of ["idle_0", "idle_1", "idle_2", "eat_3", "happy_2", "sad_1"]) {
      expect(krobiFrameUrls[name]).toBeTruthy();
    }
  });
});
