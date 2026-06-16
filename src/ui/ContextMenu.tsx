import { useEffect } from "react";

export interface MenuItem {
  label: string;
  onClick: () => void;
}

/** 커서 위치에 뜨는 커스텀 우클릭 메뉴. 바깥 클릭/Esc로 닫힘. */
export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <ul
      onMouseDown={(e) => e.stopPropagation()}
      style={{ left: x, top: y }}
      className="absolute z-50 min-w-24 overflow-hidden rounded-lg bg-white/95 py-1 text-xs shadow-lg backdrop-blur"
    >
      {items.map((item) => (
        <li key={item.label}>
          <button
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className="block w-full px-3 py-1.5 text-left font-semibold text-slate-700 hover:bg-sky-100"
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
