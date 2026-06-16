import { describe, expect, it } from "vitest";
import { classifyApp } from "./appCategories";

describe("classifyApp", () => {
  it("maps known dev apps to maker by bundle id", () => {
    expect(classifyApp("Code", "com.microsoft.VSCode")).toBe("maker");
    expect(classifyApp("iTerm2", "com.googlecode.iterm2")).toBe("maker");
  });
  it("maps browsers/readers to sage", () => {
    expect(classifyApp("Google Chrome", "com.google.Chrome")).toBe("sage");
    expect(classifyApp("Preview", "com.apple.Preview")).toBe("sage");
  });
  it("maps games/media to wild", () => {
    expect(classifyApp("Steam", "com.valvesoftware.steam")).toBe("wild");
    expect(classifyApp("Spotify", "com.spotify.client")).toBe("wild");
  });
  it("falls back to a name substring when bundle id is unknown", () => {
    expect(classifyApp("Some Terminal", "com.unknown.thing")).toBe("maker");
  });
  it("returns null for an unmapped app", () => {
    expect(classifyApp("Totally Unknown App", "com.acme.unknown")).toBeNull();
  });
});
