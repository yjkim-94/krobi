import { opaqueBoundsFromAlpha, unionBounds, type Box } from "./contentBounds";

/** 스프라이트 시트 PNG를 로드. */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * 주어진 셀들의 불투명 픽셀 합집합 경계(셀 로컬 좌표).
 * 모든 프레임을 포함하므로 어떤 프레임도 잘리지 않는 표시 박스가 된다.
 */
export function measureBounds(
  img: HTMLImageElement,
  cellSize: number,
  columns: number,
  cells: number[],
  threshold = 8,
): Box {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);

  let acc: Box | null = null;
  for (const cell of cells) {
    const col = cell % columns;
    const row = Math.floor(cell / columns);
    const { data } = ctx.getImageData(
      col * cellSize,
      row * cellSize,
      cellSize,
      cellSize,
    );
    acc = unionBounds(acc, opaqueBoundsFromAlpha(data, cellSize, cellSize, threshold));
  }
  // 전부 투명이면(이론상 없음) 셀 전체로 폴백.
  return acc ?? { minX: 0, minY: 0, maxX: cellSize - 1, maxY: cellSize - 1 };
}
