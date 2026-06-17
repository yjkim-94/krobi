import { useEffect, useRef, useState } from "react";
import type { AnimationName } from "./types";
import type { EvoPhase } from "../ui/EvolutionFx";
import { usePetAnimation } from "./usePetAnimation";
import { usePetDrag } from "./usePetDrag";
import { Pet } from "./Pet";
import { EvolveReadyFx } from "../ui/EvolveReadyFx";
import { loadImage, measureBounds } from "./sheetImage";
import { boxSize, type Box } from "./contentBounds";
import { formAppearance } from "./formAppearance";
import { speciesFormAsset } from "./speciesFormAssets";

export function PetSlot({
  speciesId,
  form,
  base,
  oneShot,
  onOneShotEnd,
  position,
  originOffset,
  margin,
  evoPhase,
  evoReady,
  onSizeReady,
  onClick,
  onContextMenu,
  onDragLive,
  onDrop,
}: {
  speciesId: string;
  form: string;
  base: AnimationName;
  oneShot: AnimationName | null;
  onOneShotEnd: () => void;
  position: { x: number; y: number };
  originOffset: { x: number; y: number };
  margin: number;
  evoPhase: EvoPhase;
  evoReady: boolean;
  onSizeReady: (w: number, h: number) => void;
  onClick: () => void;
  onContextMenu: () => void;
  onDragLive: (dx: number, dy: number) => void;
  onDrop: (dx: number, dy: number) => void;
}) {
  // 실제 폼 에셋이 없으면 그 종의 stage1 로 대체(기존 단일-종 placeholder 동작을 종별로 일반화).
  // acquireSpecies 로 보유한 모든 종은 stage1 실제 아트가 있다고 가정한다(도감에서 그렇게만 추가됨).
  const exact = speciesFormAsset(speciesId, form);
  const asset = exact ?? speciesFormAsset(speciesId, "stage1");
  if (!asset) throw new Error(`no sprite asset for species "${speciesId}"`);
  const appearance = exact ? { filter: "none", scale: 1 } : formAppearance(form);

  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const frozenRef = useRef<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setImg(null);
    setBox(null);
    (async () => {
      const image = await loadImage(asset.sheetUrl);
      if (cancelled) return;
      const cells = Object.values(asset.manifest.animations).flatMap((a) => a.frames);
      const measured = measureBounds(image, asset.manifest.frameSize, asset.manifest.columns, cells);
      setImg(image);
      setBox(measured);
    })().catch((e) => console.error(`${speciesId} 시트 로드/측정 실패:`, e));
    return () => {
      cancelled = true;
    };
  }, [asset, speciesId]);

  const cell = usePetAnimation(asset.manifest, base, oneShot, onOneShotEnd);

  const [liveOffset, setLiveOffset] = useState({ dx: 0, dy: 0 });
  const [dragging, setDragging] = useState(false);
  // 왼쪽/위쪽으로는 현재 창 경계(originOffset - margin)까지만 끌리게 막는다 — 창은 setSize 로만
  // 커지므로(오른쪽/아래쪽 성장만 가능) 그 방향은 막지 않으면 펫이 창 밖으로 보이지 않게 된다.
  function clamp(dx: number, dy: number) {
    const minDx = originOffset.x - margin - position.x;
    const minDy = originOffset.y - margin - position.y;
    return { dx: Math.max(dx, minDx), dy: Math.max(dy, minDy) };
  }

  const drag = usePetDrag(
    onClick,
    (dx, dy) => {
      const c = clamp(dx, dy);
      setDragging(true);
      setLiveOffset(c);
      onDragLive(c.dx, c.dy);
    },
    (dx, dy) => {
      const c = clamp(dx, dy);
      setDragging(false);
      setLiveOffset({ dx: 0, dy: 0 });
      onDrop(c.dx, c.dy);
    },
  );

  let destW = 0;
  let destH = 0;
  if (box) {
    const cb = boxSize(box);
    destW = Math.round(cb.w * asset.manifest.displayScale * appearance.scale);
    destH = Math.round(cb.h * asset.manifest.displayScale * appearance.scale);
    // 진화 연출 중엔 펫 픽셀 크기를 고정(창이 커져도 안 커지게). idle 로 돌아오면 해제.
    if (evoPhase === "idle") {
      frozenRef.current = null;
    } else {
      if (!frozenRef.current) frozenRef.current = { w: destW, h: destH };
      destW = frozenRef.current.w;
      destH = frozenRef.current.h;
    }
  }

  useEffect(() => {
    if (destW > 0 && destH > 0) onSizeReady(destW, destH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destW, destH]);

  if (!img || !box) return null;

  const petFilter =
    evoPhase === "flash"
      ? "brightness(0) invert(1) blur(2px) drop-shadow(0 0 14px #fff) drop-shadow(0 0 26px #fff)"
      : evoPhase === "charge"
        ? `${appearance.filter === "none" ? "" : appearance.filter} brightness(1.3) drop-shadow(0 0 8px #ffd36b)`.trim()
        : appearance.filter;

  return (
    <div
      onMouseDown={drag.onMouseDown}
      onMouseMove={drag.onMouseMove}
      onMouseUp={drag.onMouseUp}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu();
      }}
      style={{
        position: "absolute",
        left: position.x - originOffset.x + margin + liveOffset.dx,
        top: position.y - originOffset.y + margin + liveOffset.dy,
        zIndex: dragging ? 2 : 1,
        opacity: evoPhase === "hidden" ? 0 : 1,
        userSelect: "none",
      }}
    >
      {evoReady && <EvolveReadyFx />}
      <div style={{ position: "relative", zIndex: 1 }}>
        <Pet
          img={img}
          cell={cell}
          columns={asset.manifest.columns}
          cellSize={asset.manifest.frameSize}
          box={box}
          destW={destW}
          destH={destH}
          filter={petFilter}
        />
      </div>
    </div>
  );
}
