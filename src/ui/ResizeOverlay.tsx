import { useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";

const MIN = 80;

/**
 * 리사이즈 모드 오버레이.
 * - 우하단 핸들 드래그 → setSize 로 창 실시간 리사이즈
 * - O(저장): onDone(true) — 부모가 현재 크기를 영구 저장
 * - X(취소): 진입 직전 크기로 복원 후 onDone(false)
 */
export function ResizeOverlay({ onDone }: { onDone: (commit: boolean) => void }) {
  // 진입 직전 크기(취소 복원용).
  const startSize = useRef({ w: window.innerWidth, h: window.innerHeight });
  const drag = useRef<{ mx: number; my: number; w: number; h: number } | null>(null);

  function onHandleDown(e: React.MouseEvent) {
    e.stopPropagation();
    drag.current = { mx: e.screenX, my: e.screenY, w: window.innerWidth, h: window.innerHeight };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  function onMove(e: MouseEvent) {
    if (!drag.current) return;
    const w = Math.max(MIN, drag.current.w + (e.screenX - drag.current.mx));
    const h = Math.max(MIN, drag.current.h + (e.screenY - drag.current.my));
    void getCurrentWindow().setSize(new LogicalSize(w, h));
  }
  function onUp() {
    drag.current = null;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  }

  function cancel() {
    void getCurrentWindow()
      .setSize(new LogicalSize(startSize.current.w, startSize.current.h))
      .then(() => onDone(false));
  }

  return (
    <div className="absolute inset-0 z-40" onMouseDown={(e) => e.stopPropagation()}>
      {/* 격자 가이드 */}
      <div
        className="absolute inset-1 rounded border-2 border-dashed border-sky-400/80"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(56,189,248,.25) 1px, transparent 1px)," +
            "linear-gradient(to bottom, rgba(56,189,248,.25) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />
      {/* O / X */}
      <div className="absolute right-1 top-1 flex gap-1">
        <button
          onClick={() => onDone(true)}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white shadow"
        >
          ✓
        </button>
        <button
          onClick={cancel}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white shadow"
        >
          ✕
        </button>
      </div>
      {/* 우하단 리사이즈 핸들 */}
      <div
        onMouseDown={onHandleDown}
        className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize rounded-tl bg-sky-500/80"
      />
    </div>
  );
}
