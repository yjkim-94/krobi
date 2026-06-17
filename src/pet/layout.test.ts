import { describe, expect, it } from "vitest";
import { rectsOverlap, defaultPosition, resolveDropPosition, layoutBounds, type Rect } from "./layout";

describe("rectsOverlap", () => {
  it("true when boxes intersect", () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
  });
  it("false when edges merely touch", () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
  });
  it("false when far apart", () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 100, y: 100, w: 10, h: 10 })).toBe(false);
  });
});

describe("defaultPosition", () => {
  it("places the first pet at the origin", () => {
    expect(defaultPosition([], { w: 30, h: 20 }, 8)).toEqual({ x: 0, y: 0 });
  });

  it("places a same-height pet to the right, sharing the same bottom line", () => {
    const existing: Rect[] = [{ x: 0, y: 0, w: 40, h: 50 }];
    expect(defaultPosition(existing, { w: 30, h: 50 }, 8)).toEqual({ x: 48, y: 0 });
  });

  it("bottom-aligns a taller new pet (its y goes negative)", () => {
    const existing: Rect[] = [{ x: 0, y: 0, w: 40, h: 50 }];
    expect(defaultPosition(existing, { w: 30, h: 80 }, 8)).toEqual({ x: 48, y: -30 });
  });
});

describe("resolveDropPosition", () => {
  it("returns the dropped position unchanged when nothing overlaps", () => {
    const dropped: Rect = { x: 100, y: 100, w: 10, h: 10 };
    expect(resolveDropPosition(dropped, [])).toEqual({ x: 100, y: 100 });
  });

  it("snaps to the nearest non-overlapping spot when it overlaps another pet", () => {
    const dropped: Rect = { x: 0, y: 0, w: 10, h: 10 };
    const others: Rect[] = [{ x: 0, y: 0, w: 10, h: 10 }];
    expect(resolveDropPosition(dropped, others, 10)).toEqual({ x: 10, y: 0 });
  });
});

describe("layoutBounds", () => {
  it("returns null for an empty list", () => {
    expect(layoutBounds([])).toBeNull();
  });

  it("returns the union bounding box of all rects", () => {
    const rects: Rect[] = [
      { x: 0, y: 0, w: 10, h: 10 },
      { x: -5, y: 20, w: 10, h: 10 },
    ];
    expect(layoutBounds(rects)).toEqual({ minX: -5, minY: 0, maxX: 9, maxY: 29 });
  });
});
