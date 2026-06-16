import { useEffect, useRef, useState } from "react";
import type { AnimationName, PetManifest } from "./types";
import { advanceFrame, getAnimationDef } from "./animation";

/**
 * 현재 재생할 시트 셀 인덱스를 반환.
 * - current = oneShot(있으면) ?? base
 * - loop:false 애니가 끝나면 onOneShotEnd() 호출
 */
export function usePetAnimation(
  manifest: PetManifest,
  base: AnimationName,
  oneShot: AnimationName | null,
  onOneShotEnd: () => void,
): number {
  const current: AnimationName = oneShot ?? base;
  const def = getAnimationDef(manifest, current);

  const [index, setIndex] = useState(0);

  // 콜백을 ref로 보관해 effect 의존성을 안정화
  const endRef = useRef(onOneShotEnd);
  endRef.current = onOneShotEnd;

  useEffect(() => {
    setIndex(0);
    let i = 0;
    const id = window.setInterval(() => {
      const r = advanceFrame(i, def.frames.length, def.loop);
      i = r.index;
      setIndex(r.index);
      if (r.finished) {
        window.clearInterval(id);
        endRef.current();
      }
    }, 1000 / def.fps);
    return () => window.clearInterval(id);
  }, [current, def.fps, def.loop, def.frames.length]);

  return def.frames[Math.min(index, def.frames.length - 1)];
}
