import { unionBounds, type Box } from "./contentBounds";

export type Point = { x: number; y: number };
export type Rect = Point & { w: number; h: number };
export type PetPosition = Point & { speciesId: string };
export type LayoutState = { positions: PetPosition[] };

/** 두 사각형이 겹치는지(경계가 닿기만 하는 건 겹침이 아님). */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * 새 펫의 기본 위치: 기존 펫들 중 가장 오른쪽 옆, 같은 바닥선(bottom)에 맞춤.
 * 기존 펫이 없으면 원점에 배치.
 */
export function defaultPosition(existing: Rect[], size: { w: number; h: number }, gap: number): Point {
  if (existing.length === 0) return { x: 0, y: 0 };
  const ground = Math.max(...existing.map((r) => r.y + r.h));
  const rightX = Math.max(...existing.map((r) => r.x + r.w)) + gap;
  return { x: rightX, y: ground - size.h };
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * dropped 위치가 others 중 하나와 겹치면, 겹치지 않는 가장 가까운 위치로 옮긴다.
 * 겹치지 않으면 dropped 위치 그대로 반환. step 간격으로 점점 넓어지는 고리를 탐색한다.
 */
export function resolveDropPosition(
  dropped: Rect,
  others: Rect[],
  step = 16,
  maxRings = 50,
): Point {
  const fitsAt = (p: Point) => !others.some((o) => rectsOverlap({ ...dropped, x: p.x, y: p.y }, o));
  if (fitsAt(dropped)) return { x: dropped.x, y: dropped.y };
  for (let ring = 1; ring <= maxRings; ring++) {
    const r = ring * step;
    const candidates: Point[] = [
      { x: dropped.x + r, y: dropped.y },
      { x: dropped.x - r, y: dropped.y },
      { x: dropped.x, y: dropped.y + r },
      { x: dropped.x, y: dropped.y - r },
      { x: dropped.x + r, y: dropped.y + r },
      { x: dropped.x + r, y: dropped.y - r },
      { x: dropped.x - r, y: dropped.y + r },
      { x: dropped.x - r, y: dropped.y - r },
    ].sort((a, b) => dist(a, dropped) - dist(b, dropped));
    const found = candidates.find(fitsAt);
    if (found) return found;
  }
  return { x: dropped.x, y: dropped.y };
}

/** 모든 사각형을 감싸는 최소 경계 박스. 비어있으면 null. */
export function layoutBounds(rects: Rect[]): Box | null {
  return rects.reduce<Box | null>(
    (acc, r) => unionBounds(acc, { minX: r.x, minY: r.y, maxX: r.x + r.w - 1, maxY: r.y + r.h - 1 }),
    null,
  );
}
