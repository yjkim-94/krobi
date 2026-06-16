import { describe, it, expect } from "vitest";
import { baseAnimation, advanceFrame, cellPosition } from "./animation";

describe("baseAnimation", () => {
  it("스탯이 건강하면 idle", () => {
    expect(baseAnimation(100, 100)).toBe("idle");
    expect(baseAnimation(30, 30)).toBe("idle");
  });
  it("hunger가 임계값 미만이면 sad", () => {
    expect(baseAnimation(29, 100)).toBe("sad");
  });
  it("cleanliness가 임계값 미만이면 sad", () => {
    expect(baseAnimation(100, 10)).toBe("sad");
  });
});

describe("advanceFrame", () => {
  it("범위 내에서 다음 프레임으로", () => {
    expect(advanceFrame(0, 3, true)).toEqual({ index: 1, finished: false });
  });
  it("루프면 마지막 다음에 0으로 복귀", () => {
    expect(advanceFrame(2, 3, true)).toEqual({ index: 0, finished: false });
  });
  it("루프 아니면 마지막에 멈추고 finished=true", () => {
    expect(advanceFrame(3, 4, false)).toEqual({ index: 3, finished: true });
  });
});

describe("cellPosition", () => {
  it("셀 인덱스를 격자 열/행으로 변환", () => {
    expect(cellPosition(0, 8)).toEqual({ col: 0, row: 0 });
    expect(cellPosition(7, 8)).toEqual({ col: 7, row: 0 });
    expect(cellPosition(8, 8)).toEqual({ col: 0, row: 1 });
    expect(cellPosition(23, 8)).toEqual({ col: 7, row: 2 });
  });
});
