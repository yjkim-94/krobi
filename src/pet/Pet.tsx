import { cellPosition } from "./animation";

/**
 * 스프라이트 시트에서 현재 셀 하나를 픽셀 또렷하게 렌더.
 * background-position으로 셀을 잘라내고, 시트 전체를 displayScale로 확대한다.
 * 드래그 영역 포함, 드래그 시 선택 방지.
 */
export function Pet({
  sheetUrl,
  cell,
  columns,
  size,
}: {
  sheetUrl: string;
  cell: number;
  columns: number;
  size: number;
}) {
  const { col, row } = cellPosition(cell, columns);
  return (
    <div
      data-tauri-drag-region
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${sheetUrl})`,
        backgroundPosition: `-${col * size}px -${row * size}px`,
        backgroundSize: `${columns * size}px auto`,
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
        userSelect: "none",
      }}
    />
  );
}
