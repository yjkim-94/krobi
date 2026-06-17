import { useRef } from "react";
import { exceededThreshold } from "./dragMath";

/**
 * 펫 좌클릭 상호작용(펫 전용, 창 전체가 아니라 그 펫의 위치만 바뀜):
 * - 누른 채 임계값 초과 이동 → onDragMove(dx, dy) 계속 호출(드래그 시작점 기준 누적 이동량)
 * - 임계값 초과 후 떼기 → onDrop(dx, dy)
 * - 이동 없이 떼기 → onClick()
 */
export function usePetDrag(
  onClick: () => void,
  onDragMove: (dx: number, dy: number) => void,
  onDrop: (dx: number, dy: number) => void,
  threshold = 4,
) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return; // 좌버튼만
    e.stopPropagation(); // 배경(창 전체) 드래그 핸들러로 전파되지 않게
    start.current = { x: e.screenX, y: e.screenY };
    dragged.current = false;
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!start.current) return;
    const dx = e.screenX - start.current.x;
    const dy = e.screenY - start.current.y;
    if (!dragged.current && exceededThreshold(dx, dy, threshold)) dragged.current = true;
    if (dragged.current) onDragMove(dx, dy);
  }

  function onMouseUp(e: React.MouseEvent) {
    if (!start.current) return;
    const dx = e.screenX - start.current.x;
    const dy = e.screenY - start.current.y;
    if (dragged.current) onDrop(dx, dy);
    else onClick();
    start.current = null;
  }

  return { onMouseDown, onMouseMove, onMouseUp };
}
