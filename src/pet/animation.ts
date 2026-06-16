import type { AnimationDef, AnimationName, PetManifest } from "./types";

export const LOW_THRESHOLD = 30;

/** 스탯으로부터 기본(루프) 애니를 결정 */
export function baseAnimation(
  hunger: number,
  cleanliness: number,
  low: number = LOW_THRESHOLD,
): AnimationName {
  return hunger < low || cleanliness < low ? "sad" : "idle";
}

export function getAnimationDef(
  manifest: PetManifest,
  name: AnimationName,
): AnimationDef {
  return manifest.animations[name];
}

/** 다음 프레임 인덱스와 종료 여부 */
export function advanceFrame(
  index: number,
  frameCount: number,
  loop: boolean,
): { index: number; finished: boolean } {
  const next = index + 1;
  if (next < frameCount) return { index: next, finished: false };
  return loop
    ? { index: 0, finished: false }
    : { index: frameCount - 1, finished: true };
}

/** 시트 셀 인덱스를 격자 좌표(열, 행)로 변환 */
export function cellPosition(
  cell: number,
  columns: number,
): { col: number; row: number } {
  return { col: cell % columns, row: Math.floor(cell / columns) };
}
