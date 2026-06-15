/** 단일 프레임을 픽셀 또렷하게 렌더. 드래그 영역 포함, 드래그 시 이미지 선택 방지. */
export function Pet({ frameUrl, size }: { frameUrl: string; size: number }) {
  return (
    <img
      src={frameUrl}
      width={size}
      height={size}
      alt="pet"
      draggable={false}
      data-tauri-drag-region
      style={{ imageRendering: "pixelated", userSelect: "none" }}
    />
  );
}
