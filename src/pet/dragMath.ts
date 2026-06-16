/** 마우스 이동량이 임계 반경을 넘었는지(넘으면 드래그, 아니면 클릭). */
export function exceededThreshold(dx: number, dy: number, threshold: number): boolean {
  return Math.hypot(dx, dy) > threshold;
}
