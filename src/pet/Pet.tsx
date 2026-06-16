import { useEffect, useRef } from "react";
import type { Box } from "./contentBounds";

/**
 * 현재 셀의 콘텐츠 박스 영역을 canvas로 잘라 destW×destH로 픽셀 또렷하게 렌더.
 * 콘텐츠 박스만 그리므로 빈 여백 없이 꽉 차고, 어떤 프레임도 잘리지 않는다.
 */
export function Pet({
  img,
  cell,
  columns,
  cellSize,
  box,
  destW,
  destH,
}: {
  img: HTMLImageElement;
  cell: number;
  columns: number;
  cellSize: number;
  box: Box;
  destW: number;
  destH: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = destW;
    canvas.height = destH;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, destW, destH);

    const col = cell % columns;
    const row = Math.floor(cell / columns);
    const srcX = col * cellSize + box.minX;
    const srcY = row * cellSize + box.minY;
    const srcW = box.maxX - box.minX + 1;
    const srcH = box.maxY - box.minY + 1;
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, destW, destH);
  }, [img, cell, columns, cellSize, box, destW, destH]);

  return <canvas ref={ref} style={{ display: "block", userSelect: "none" }} />;
}
