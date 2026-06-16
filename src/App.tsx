import { useEffect, useRef, useState } from "react";
import { load, type Store } from "@tauri-apps/plugin-store";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import "./App.css";
import manifest from "./assets/pets/krobi/stage1/manifest.json";
import type { AnimationName, PetManifest } from "./pet/types";
import { baseAnimation } from "./pet/animation";
import { krobiSheetUrl } from "./pet/frameUrls";
import { usePetAnimation } from "./pet/usePetAnimation";
import { Pet } from "./pet/Pet";
import { useWindowDrag } from "./pet/useWindowDrag";
import { loadImage, measureBounds } from "./pet/sheetImage";
import { fitWindowSize, fitScale, boxSize, type Box } from "./pet/contentBounds";
import { ContextMenu } from "./ui/ContextMenu";
import { ResizeOverlay } from "./ui/ResizeOverlay";

const PET = manifest as PetManifest;
const STORE_FILE = "krobi_data.json";
const VERSION = "1.0.0";
const HUNGER_RATE = 1; // 포만감: 분당 -1
const TICK_MS = 60_000;
const MARGIN = 12; // 펫 주변 여백(px)

type Status = { satiety: number };
type PetData = {
  name: string;
  level: number;
  status: Status;
  last_updated: string;
};
type WindowSize = { width: number; height: number };

const clampMin0 = (v: number) => Math.max(0, v);
const clampMax100 = (v: number) => Math.min(100, v);

function defaultPet(): PetData {
  return {
    name: "크로비",
    level: 1,
    status: { satiety: 100 },
    last_updated: new Date().toISOString(),
  };
}

// 구버전 저장(hunger/cleanliness)에서 satiety로 마이그레이션.
function migrate(raw: unknown): PetData {
  const base = defaultPet();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const status = (r.status ?? {}) as Record<string, unknown>;
  const satiety =
    typeof status.satiety === "number"
      ? status.satiety
      : typeof status.hunger === "number"
        ? status.hunger
        : 100;
  return {
    name: typeof r.name === "string" ? r.name : base.name,
    level: typeof r.level === "number" ? r.level : base.level,
    status: { satiety },
    last_updated:
      typeof r.last_updated === "string" ? r.last_updated : base.last_updated,
  };
}

function App() {
  const storeRef = useRef<Store | null>(null);
  const [pet, setPet] = useState<PetData | null>(null);
  const [oneShot, setOneShot] = useState<AnimationName | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [inner, setInner] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [resizing, setResizing] = useState(false);

  async function persistPet(next: PetData) {
    const store = storeRef.current;
    if (!store) return;
    await store.set("version", VERSION);
    await store.set("pet", next);
    await store.save();
  }

  // 펫 데이터 로드 + 오프라인 보정 + 감소 틱.
  useEffect(() => {
    let intervalId: number | undefined;
    (async () => {
      const store = await load(STORE_FILE, { defaults: {}, autoSave: false });
      storeRef.current = store;
      let current = migrate(await store.get("pet"));

      const now = Date.now();
      const last = new Date(current.last_updated).getTime();
      const elapsedMin = Math.max(0, Math.floor((now - last) / 60_000));
      if (elapsedMin > 0) {
        current = {
          ...current,
          status: { satiety: clampMin0(current.status.satiety - elapsedMin * HUNGER_RATE) },
          last_updated: new Date(now).toISOString(),
        };
      }
      await persistPet(current);
      setPet(current);

      intervalId = window.setInterval(() => {
        setPet((prev) => {
          if (!prev) return prev;
          const next: PetData = {
            ...prev,
            status: { satiety: clampMin0(prev.status.satiety - HUNGER_RATE) },
            last_updated: new Date().toISOString(),
          };
          void persistPet(next);
          return next;
        });
      }, TICK_MS);
    })();
    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  // 시트 로드 + 콘텐츠 경계 측정 + 초기 창 크기(저장값 우선, 없으면 자동맞춤).
  useEffect(() => {
    const cells = Object.values(PET.animations).flatMap((a) => a.frames);
    (async () => {
      const store = storeRef.current ?? (await load(STORE_FILE, { defaults: {}, autoSave: false }));
      const image = await loadImage(krobiSheetUrl);
      const measured = measureBounds(image, PET.frameSize, PET.columns, cells);
      setImg(image);
      setBox(measured);

      const saved = (await store.get("window_size")) as WindowSize | undefined;
      const size = saved ?? fitWindowSize(boxSize(measured), PET.displayScale, MARGIN);
      await getCurrentWindow().setSize(new LogicalSize(size.width, size.height));
    })().catch((e) => console.error("펫 시트 로드/측정 실패:", e));
  }, []);

  // 창 크기 변화 추적(리사이즈 시 펫 스케일 갱신).
  useEffect(() => {
    const onResize = () => setInner({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const base: AnimationName = pet ? baseAnimation(pet.status.satiety) : "idle";
  const cell = usePetAnimation(PET, base, oneShot, () => setOneShot(null));

  const drag = useWindowDrag(() => setOneShot("happy"));

  function feed() {
    setOneShot("eat");
    setPet((prev) => {
      if (!prev) return prev;
      const next: PetData = {
        ...prev,
        status: { satiety: clampMax100(prev.status.satiety + 20) },
        last_updated: new Date().toISOString(),
      };
      void persistPet(next);
      return next;
    });
  }

  async function commitSize() {
    const store = storeRef.current;
    if (store) {
      await store.set("window_size", { width: window.innerWidth, height: window.innerHeight });
      await store.save();
    }
    setResizing(false);
  }

  if (!pet || !img || !box) return null;

  // 콘텐츠 박스를 가용 영역(창 - 마진)에 비율 유지로 맞춤.
  const cb = boxSize(box);
  const scale = fitScale(cb, inner.w - MARGIN * 2, inner.h - MARGIN * 2);
  const destW = Math.round(cb.w * scale);
  const destH = Math.round(cb.h * scale);

  return (
    <div
      onMouseDown={drag.onMouseDown}
      onMouseMove={drag.onMouseMove}
      onMouseUp={drag.onMouseUp}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!resizing) setMenu({ x: e.clientX, y: e.clientY });
      }}
      className="relative flex h-screen w-screen items-center justify-center bg-transparent"
      style={{ userSelect: "none" }}
    >
      <Pet
        img={img}
        cell={cell}
        columns={PET.columns}
        cellSize={PET.frameSize}
        box={box}
        destW={destW}
        destH={destH}
      />

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: "밥주기", onClick: feed },
            { label: "크기 조절", onClick: () => setResizing(true) },
          ]}
        />
      )}

      {resizing && (
        <ResizeOverlay
          onDone={(commit) => {
            if (commit) void commitSize();
            else setResizing(false);
          }}
        />
      )}
    </div>
  );
}

export default App;
