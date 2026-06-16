export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** RGBA 픽셀 배열에서 불투명(alpha>threshold) 픽셀의 경계 박스. 없으면 null. */
export function opaqueBoundsFromAlpha(
  data: Uint8ClampedArray | number[],
  w: number,
  h: number,
  threshold = 8,
): Box | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return null;
  return { minX, minY, maxX, maxY };
}

/** 두 박스의 합집합(둘 다 포함하는 최소 박스). */
export function unionBounds(a: Box | null, b: Box | null): Box | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/** 박스의 픽셀 크기 (경계 포함). */
export function boxSize(box: Box): { w: number; h: number } {
  return { w: box.maxX - box.minX + 1, h: box.maxY - box.minY + 1 };
}

/** 콘텐츠 크기 × 배율 + 양쪽 마진 = 기본 창 콘텐츠 크기(논리 px). */
export function fitWindowSize(
  content: { w: number; h: number },
  scale: number,
  margin: number,
): { width: number; height: number } {
  return {
    width: Math.round(content.w * scale + margin * 2),
    height: Math.round(content.h * scale + margin * 2),
  };
}

/** 가용 영역에 콘텐츠를 비율 유지로 맞추는 배율. */
export function fitScale(
  content: { w: number; h: number },
  availW: number,
  availH: number,
): number {
  return Math.min(availW / content.w, availH / content.h);
}
