import { useEffect, useRef, useState } from "react";
import { load, type Store } from "@tauri-apps/plugin-store";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { Menu } from "@tauri-apps/api/menu";
import "./App.css";
import manifest from "./assets/pets/krombi/stage1/manifest.json";
import krombiSpecies from "./assets/pets/krombi/species.json";
import type { AnimationName, PetManifest, SpeciesDef } from "./pet/types";
import { baseAnimation } from "./pet/animation";
import { krombiSheetUrl } from "./pet/frameUrls";
import { usePetAnimation } from "./pet/usePetAnimation";
import { Pet } from "./pet/Pet";
import { useWindowDrag } from "./pet/useWindowDrag";
import { useActiveAppTracker } from "./pet/useActiveAppTracker";
import { loadImage, measureBounds } from "./pet/sheetImage";
import { fitWindowSize, fitScale, boxSize, type Box } from "./pet/contentBounds";
import { formAppearance } from "./pet/formAppearance";
import { StatusPanel } from "./ui/StatusPanel";
import { ResizeOverlay } from "./ui/ResizeOverlay";
import {
  type PetData,
  type TendencyKey,
  migrate,
  applyTick,
  canEvolve,
  applyEvolution,
} from "./pet/petState";

const PET = manifest as PetManifest;
const SPECIES = krombiSpecies as SpeciesDef;
const STORE_FILE = "krobi_data.json";
const VERSION = "2.0.0";
const HUNGER_RATE = 1; // 포만감: 분당 -1
const EXP_GAIN = 10; // 경험치: 분당 +10 (잠정)
const TENDENCY_GAIN = 5; // 활성 앱 1회 감지당 +5 (잠정)
const TICK_MS = 60_000;
const MARGIN = 12; // 펫 주변 여백(px)
const PANEL_H = 96; // 펫상태 패널을 위해 창에 더할 높이(px)

type WindowSize = { width: number; height: number };

const clampMax100 = (v: number) => Math.min(100, v);

function App() {
  const storeRef = useRef<Store | null>(null);
  const [pet, setPet] = useState<PetData | null>(null);
  const [oneShot, setOneShot] = useState<AnimationName | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [inner, setInner] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [resizing, setResizing] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const baseHeightRef = useRef<number | null>(null); // 패널 펼치기 전 창 높이

  async function persistPet(next: PetData) {
    const store = storeRef.current;
    if (!store) return;
    await store.set("version", VERSION);
    await store.set("pet", next);
    await store.save();
  }

  // 펫 데이터 로드 + 오프라인 보정 + 감소/증가 틱.
  useEffect(() => {
    let intervalId: number | undefined;
    (async () => {
      const store = await load(STORE_FILE, { defaults: {}, autoSave: false });
      storeRef.current = store;
      let current = migrate(await store.get("pet"));

      const now = Date.now();
      const last = new Date(current.last_updated).getTime();
      const elapsedMin = Math.max(0, Math.floor((now - last) / 60_000));
      for (let i = 0; i < elapsedMin; i++) {
        current = applyTick(current, { satietyRate: HUNGER_RATE, expGain: EXP_GAIN });
      }
      await persistPet(current);
      setPet(current);

      intervalId = window.setInterval(() => {
        setPet((prev) => {
          if (!prev) return prev;
          const next = applyTick(prev, { satietyRate: HUNGER_RATE, expGain: EXP_GAIN });
          void persistPet(next);
          return next;
        });
      }, TICK_MS);
    })();
    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  // 활성 앱 감지 → 성향 게이지 증가(분류) 또는 미분류 카운트.
  useActiveAppTracker((key: TendencyKey | null, appName: string) => {
    setPet((prev) => {
      if (!prev) return prev;
      let next: PetData;
      if (key) {
        next = {
          ...prev,
          tendencies: { ...prev.tendencies, [key]: prev.tendencies[key] + TENDENCY_GAIN },
        };
      } else {
        next = {
          ...prev,
          unknownApps: { ...prev.unknownApps, [appName]: (prev.unknownApps[appName] ?? 0) + 1 },
        };
      }
      void persistPet(next);
      return next;
    });
  });

  // 시트 로드 + 콘텐츠 경계 측정 + 초기 창 크기.
  useEffect(() => {
    const cells = Object.values(PET.animations).flatMap((a) => a.frames);
    (async () => {
      const store = storeRef.current ?? (await load(STORE_FILE, { defaults: {}, autoSave: false }));
      const image = await loadImage(krombiSheetUrl);
      const measured = measureBounds(image, PET.frameSize, PET.columns, cells);
      setImg(image);
      setBox(measured);

      const saved = (await store.get("window_size")) as WindowSize | undefined;
      const size = saved ?? fitWindowSize(boxSize(measured), PET.displayScale, MARGIN);
      await getCurrentWindow().setSize(new LogicalSize(size.width, size.height));
    })().catch((e) => console.error("펫 시트 로드/측정 실패:", e));
  }, []);

  useEffect(() => {
    const onResize = () => setInner({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 펫상태 토글 시 창 높이를 패널만큼 늘렸다 복원.
  async function toggleStatus() {
    const win = getCurrentWindow();
    if (!showStatus) {
      baseHeightRef.current = window.innerHeight;
      await win.setSize(new LogicalSize(window.innerWidth, window.innerHeight + PANEL_H));
      setShowStatus(true);
    } else {
      const h = baseHeightRef.current ?? window.innerHeight - PANEL_H;
      await win.setSize(new LogicalSize(window.innerWidth, h));
      setShowStatus(false);
    }
  }

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

  function evolve() {
    setPet((prev) => {
      if (!prev) return prev;
      const next = applyEvolution(SPECIES, prev);
      if (next === prev) return prev;
      setOneShot("happy");
      void persistPet(next);
      return next;
    });
  }

  async function showMenu() {
    const evolvable = pet ? canEvolve(SPECIES, pet.form, pet.exp) : false;
    const menu = await Menu.new({
      items: [
        { id: "feed", text: "밥주기", action: () => feed() },
        { id: "status", text: showStatus ? "펫상태 숨기기" : "펫상태", action: () => void toggleStatus() },
        { id: "evolve", text: "진화하기", enabled: evolvable, action: () => evolve() },
        { id: "resize", text: "크기 조절", action: () => setResizing(true) },
      ],
    });
    await menu.popup();
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

  const appearance = formAppearance(pet.form);
  const cb = boxSize(box);
  const availH = inner.h - MARGIN * 2 - (showStatus ? PANEL_H : 0);
  const scale = fitScale(cb, inner.w - MARGIN * 2, availH) * appearance.scale;
  const destW = Math.round(cb.w * scale);
  const destH = Math.round(cb.h * scale);

  return (
    <div
      onMouseDown={drag.onMouseDown}
      onMouseMove={drag.onMouseMove}
      onMouseUp={drag.onMouseUp}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!resizing) void showMenu();
      }}
      className="relative flex h-screen w-screen items-center justify-center bg-transparent"
      style={{ userSelect: "none", paddingTop: showStatus ? PANEL_H : 0 }}
    >
      {showStatus && <StatusPanel pet={pet} species={SPECIES} />}

      <Pet
        img={img}
        cell={cell}
        columns={PET.columns}
        cellSize={PET.frameSize}
        box={box}
        destW={destW}
        destH={destH}
        filter={appearance.filter}
      />

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
