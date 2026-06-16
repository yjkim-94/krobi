import { useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { exceededThreshold } from "./dragMath";

/**
 * 펫 좌클릭 상호작용:
 * - 누른 채 임계값 초과 이동 → 창 드래그 시작(startDragging)
 * - 이동 없이 떼기 → onClick() (happy 트리거)
 */
export function useWindowDrag(onClick: () => void, threshold = 4) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return; // 좌버튼만
    start.current = { x: e.screenX, y: e.screenY };
    dragged.current = false;
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!start.current || dragged.current) return;
    if (exceededThreshold(e.screenX - start.current.x, e.screenY - start.current.y, threshold)) {
      dragged.current = true;
      void getCurrentWindow().startDragging();
    }
  }

  function onMouseUp() {
    if (start.current && !dragged.current) onClick();
    start.current = null;
  }

  return { onMouseDown, onMouseMove, onMouseUp };
}
