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

/** 프레임 base 이름 배열을 URL 배열로 변환 */
export function resolveFrameUrls(
  def: AnimationDef,
  urls: Record<string, string>,
): string[] {
  return def.frames.map((name) => {
    const url = urls[name];
    if (!url) throw new Error(`Missing frame asset: ${name}`);
    return url;
  });
}
