import { describe, it, expect } from "vitest";
import {
  opaqueBoundsFromAlpha,
  unionBounds,
  boxSize,
  fitWindowSize,
  fitScale,
} from "./contentBounds";

// 4x4 RGBA grid helper: opaque pixels at given [x,y] coords.
function rgba(w: number, h: number, opaque: [number, number][]): number[] {
  const data = new Array(w * h * 4).fill(0);
  for (const [x, y] of opaque) data[(y * w + x) * 4 + 3] = 255;
  return data;
}

describe("opaqueBoundsFromAlpha", () => {
  it("finds the tight box around opaque pixels", () => {
    const data = rgba(4, 4, [[1, 1], [2, 1], [2, 2]]);
    expect(opaqueBoundsFromAlpha(data, 4, 4)).toEqual({
      minX: 1, minY: 1, maxX: 2, maxY: 2,
    });
  });
  it("ignores alpha at/below threshold", () => {
    const data = new Array(2 * 2 * 4).fill(0);
    data[3] = 5; // alpha 5 at (0,0), below default threshold 8
    expect(opaqueBoundsFromAlpha(data, 2, 2)).toBeNull();
  });
});

describe("unionBounds", () => {
  it("merges two boxes", () => {
    expect(
      unionBounds(
        { minX: 1, minY: 2, maxX: 3, maxY: 4 },
        { minX: 0, minY: 3, maxX: 2, maxY: 6 },
      ),
    ).toEqual({ minX: 0, minY: 2, maxX: 3, maxY: 6 });
  });
  it("returns the non-null side when one is null", () => {
    const b = { minX: 1, minY: 1, maxX: 2, maxY: 2 };
    expect(unionBounds(null, b)).toEqual(b);
    expect(unionBounds(b, null)).toEqual(b);
    expect(unionBounds(null, null)).toBeNull();
  });
});

describe("boxSize", () => {
  it("is inclusive (maxX-minX+1)", () => {
    expect(boxSize({ minX: 1, minY: 2, maxX: 3, maxY: 6 })).toEqual({ w: 3, h: 5 });
  });
});

describe("fitWindowSize", () => {
  it("scales content and adds margin on both sides", () => {
    expect(fitWindowSize({ w: 40, h: 50 }, 2, 12)).toEqual({
      width: 104, // 40*2 + 24
      height: 124, // 50*2 + 24
    });
  });
});

describe("fitScale", () => {
  it("uses the limiting dimension to preserve aspect", () => {
    expect(fitScale({ w: 40, h: 50 }, 80, 200)).toBeCloseTo(2); // width-limited
    expect(fitScale({ w: 40, h: 50 }, 200, 50)).toBeCloseTo(1); // height-limited
  });
});
