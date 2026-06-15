import { useEffect, useMemo, useRef, useState } from "react";
import type { AnimationName, PetManifest } from "./types";
import { advanceFrame, getAnimationDef, resolveFrameUrls } from "./animation";

/**
 * 현재 재생할 프레임 URL을 반환.
 * - current = oneShot(있으면) ?? base
 * - loop:false 애니가 끝나면 onOneShotEnd() 호출
 */
export function usePetAnimation(
  manifest: PetManifest,
  urls: Record<string, string>,
  base: AnimationName,
  oneShot: AnimationName | null,
  onOneShotEnd: () => void,
): string {
  const current: AnimationName = oneShot ?? base;
  const def = getAnimationDef(manifest, current);
  const frames = useMemo(() => resolveFrameUrls(def, urls), [def, urls]);

  const [index, setIndex] = useState(0);

  // 콜백을 ref로 보관해 effect 의존성을 안정화
  const endRef = useRef(onOneShotEnd);
  endRef.current = onOneShotEnd;

  useEffect(() => {
    setIndex(0);
    let i = 0;
    const id = window.setInterval(() => {
      const r = advanceFrame(i, frames.length, def.loop);
      i = r.index;
      setIndex(r.index);
      if (r.finished) {
        window.clearInterval(id);
        endRef.current();
      }
    }, 1000 / def.fps);
    return () => window.clearInterval(id);
  }, [current, def.fps, def.loop, frames.length]);

  return frames[Math.min(index, frames.length - 1)];
}
