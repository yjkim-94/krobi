import { useEffect, useRef, useState } from "react";
import { load, type Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { Menu } from "@tauri-apps/api/menu";
import "./App.css";
import krombiSpecies from "./assets/pets/krombi/species.json";
import type { AnimationName, SpeciesDef } from "./pet/types";
import { baseAnimation } from "./pet/animation";
import { usePetAnimation } from "./pet/usePetAnimation";
import { Pet } from "./pet/Pet";
import { useWindowDrag } from "./pet/useWindowDrag";
import { useActiveAppTracker } from "./pet/useActiveAppTracker";
import { loadImage, measureBounds } from "./pet/sheetImage";
import { fitWindowSize, fitScale, boxSize, type Box } from "./pet/contentBounds";
import { formAppearance } from "./pet/formAppearance";
import { formAsset } from "./pet/petForms";
import { StatusPanel } from "./ui/StatusPanel";
import { EvolutionFx, type EvoPhase } from "./ui/EvolutionFx";
import { EvolveReadyFx } from "./ui/EvolveReadyFx";
import { ResizeOverlay } from "./ui/ResizeOverlay";
import {
  type PetData,
  type TendencyKey,
  defaultPet,
  migrate,
  applyTick,
  canEvolve,
  applyEvolution,
} from "./pet/petState";

const SPECIES = krombiSpecies as SpeciesDef;
const STAGE1 = formAsset("stage1")!; // placeholder base (항상 존재)
const STORE_FILE = "krobi_data.json";
const VERSION = "2.0.0";
const HUNGER_RATE = 1; // 포만감: 분당 -1
const EXP_GAIN = 10; // 경험치: 분당 +10 (잠정)
const TENDENCY_GAIN = 10; // 활성 앱 1회 감지당 +10 (잠정)
const APP_POLL_MS = 30_000; // 활성 앱 폴링 주기
const TICK_MS = 60_000;
const MARGIN = 12; // 펫 주변 여백(px)
const PANEL_H = 96; // 펫상태 패널을 위해 창에 더할 높이(px)
const PANEL_W = 170; // 펫상태 패널이 잘리지 않을 최소 창 너비(px)
const EVO_PAD = 90; // 진화 중 섬광이 퍼질 투명 여백(px, 사방). 펫 크기/위치는 고정.

type WindowSize = { width: number; height: number };

const clampMax100 = (v: number) => Math.min(100, v);
const delay = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
// 다음 paint 까지 기다린다(상태 변경이 화면에 실제 반영된 뒤 다음 단계로). rAF 2틱 = 한 번은 확실히 그려짐.
const nextPaint = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

// 창 리사이즈가 끝나고 레이아웃(중앙 재정렬)이 화면에 반영될 때까지 기다린다.
// 고정 delay 로 추측하지 않고 실제 resize 이벤트 + 한 프레임 더(rAF)로 확정. timeout 은 안전망.
function waitForResizeSettled(timeoutMs = 800): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("resize", onResize);
      resolve();
    };
    const onResize = () =>
      requestAnimationFrame(() => requestAnimationFrame(finish));
    window.addEventListener("resize", onResize);
    window.setTimeout(finish, timeoutMs);
  });
}

function App() {
  const storeRef = useRef<Store | null>(null);
  const [pet, setPet] = useState<PetData | null>(null);
  const [oneShot, setOneShot] = useState<AnimationName | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [inner, setInner] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [resizing, setResizing] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [evoPhase, setEvoPhase] = useState<EvoPhase>("idle");
  const baseSizeRef = useRef<{ w: number; h: number } | null>(null); // 패널 펼치기 전 창 크기
  const evoBoxRef = useRef<[number, number, number, number] | null>(null); // 진화 전 창 (x,y,w,h)
  const frozenDestRef = useRef<{ w: number; h: number } | null>(null); // 진화 중 고정할 펫 픽셀 크기

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
  }, APP_POLL_MS);

  // 현재 폼의 에셋 해석: 실제 그림이 있으면 그걸로, 없으면 stage1 + 색조 placeholder.
  const form = pet?.form ?? "stage1";
  const real = formAsset(form);
  const active = real ?? STAGE1;
  const appearance = real ? { filter: "none", scale: 1 } : formAppearance(form);
  const activeManifest = active.manifest;
  const activeSheetUrl = active.sheetUrl;

  // 폼이 바뀔 때마다 시트 로드 + 콘텐츠 경계 측정.
  useEffect(() => {
    let cancelled = false;
    setImg(null);
    setBox(null);
    (async () => {
      const image = await loadImage(activeSheetUrl);
      if (cancelled) return;
      const cells = Object.values(activeManifest.animations).flatMap((a) => a.frames);
      const measured = measureBounds(image, activeManifest.frameSize, activeManifest.columns, cells);
      setImg(image);
      setBox(measured);
    })().catch((e) => console.error("펫 시트 로드/측정 실패:", e));
    return () => {
      cancelled = true;
    };
  }, [activeSheetUrl, activeManifest]);

  // 초기 창 크기 1회 설정(저장값 우선, 없으면 자동맞춤). 이후 폼 변경엔 크기 유지.
  const sizedRef = useRef(false);
  useEffect(() => {
    if (sizedRef.current || !box) return;
    sizedRef.current = true;
    (async () => {
      const store = storeRef.current ?? (await load(STORE_FILE, { defaults: {}, autoSave: false }));
      const saved = (await store.get("window_size")) as WindowSize | undefined;
      const size = saved ?? fitWindowSize(boxSize(box), activeManifest.displayScale, MARGIN);
      await getCurrentWindow().setSize(new LogicalSize(size.width, size.height));
    })().catch((e) => console.error("창 크기 설정 실패:", e));
  }, [box, activeManifest]);

  useEffect(() => {
    const onResize = () => setInner({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 펫상태 토글 시 창을 패널 크기만큼 늘렸다 복원(너비도 보장해 패널이 잘리지 않게).
  async function toggleStatus() {
    const win = getCurrentWindow();
    if (!showStatus) {
      baseSizeRef.current = { w: window.innerWidth, h: window.innerHeight };
      const w = Math.max(window.innerWidth, PANEL_W);
      await win.setSize(new LogicalSize(w, window.innerHeight + PANEL_H));
      setShowStatus(true);
    } else {
      const b = baseSizeRef.current ?? { w: window.innerWidth, h: window.innerHeight - PANEL_H };
      await win.setSize(new LogicalSize(b.w, b.h));
      setShowStatus(false);
    }
  }

  const base: AnimationName = pet ? baseAnimation(pet.status.satiety) : "idle";
  const cell = usePetAnimation(activeManifest, base, oneShot, () => setOneShot(null));
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

  // 진화 동안 창을 사방 EVO_PAD 만큼 키운다(위치+크기를 Rust 한 호출로 동시에 바꿔 튐 방지). 펫은 frozen 크기로 제자리 유지.
  async function growForEvo() {
    try {
      evoBoxRef.current = await invoke<[number, number, number, number]>("evolve_grow", { pad: EVO_PAD });
    } catch (e) {
      console.error("진화 창 확장 실패:", e);
    }
  }
  async function restoreFromEvo() {
    const b = evoBoxRef.current;
    if (!b) return;
    evoBoxRef.current = null;
    try {
      await invoke("evolve_restore", { x: b[0], y: b[1], w: b[2], h: b[3] });
    } catch (e) {
      console.error("진화 창 복원 실패:", e);
    }
  }

  // 진화 타임라인: 상태창 켬/끔 상관없이 동일한 단일 경로. 창 크기는 grow/restore 로만 바꾸고,
  // 상태창은 진화 동안 렌더에서만 숨겼다(panelOpen) idle 에 다시 보인다. 펫 숨김이 paint된 뒤에야
  // 창을 키워(중간 튐 가림), resize 가 화면에 반영(중앙 재정렬)된 걸 확인하고 펫을 내보낸다.
  function evolve() {
    if (!pet || !canEvolve(SPECIES, pet.form, pet.exp) || evoPhase !== "idle") return;
    void (async () => {
      // ② 펫·상태창 숨김 → 숨김이 실제 화면에 그려질 때까지 대기(이 렌더에서 펫 크기도 frozen 으로 고정).
      setEvoPhase("hidden");
      await nextPaint();

      // ③ 창 확장 → 중앙 재정렬이 반영될 때까지 대기(고정 delay 가 아니라 실제 resize 이벤트로).
      const grown = waitForResizeSettled();
      await growForEvo();
      await grown;

      // ④/⑤ 펫 등장 + 진화 연출
      setEvoPhase("charge");
      await delay(1350);
      setEvoPhase("flash");
      setPet((prev) => {
        if (!prev) return prev;
        const next = applyEvolution(SPECIES, prev);
        if (next === prev) return prev;
        void persistPet(next);
        return next;
      });
      await delay(750);
      setEvoPhase("reveal");
      await delay(1650);

      // ⑥ 창 원복(펫은 frozen 유지하다 원복 후 idle) → ⑦ idle 이 되면 상태창이 다시 보인다.
      const restored = waitForResizeSettled();
      await restoreFromEvo();
      await restored;
      setEvoPhase("idle");
      setOneShot("happy");
    })();
  }

  function reset() {
    const next = defaultPet();
    void persistPet(next);
    setPet(next);
  }

  async function showMenu() {
    const evolvable = pet ? canEvolve(SPECIES, pet.form, pet.exp) && evoPhase === "idle" : false;
    const menu = await Menu.new({
      items: [
        { id: "feed", text: "밥주기", action: () => feed() },
        { id: "status", text: showStatus ? "펫상태 숨기기" : "펫상태", action: () => void toggleStatus() },
        { id: "evolve", text: "진화하기", enabled: evolvable, action: () => evolve() },
        { id: "resize", text: "크기 조절", action: () => setResizing(true) },
        { id: "reset", text: "초기화", action: () => reset() },
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

  const cb = boxSize(box);
  const availH = inner.h - MARGIN * 2 - (showStatus ? PANEL_H : 0);
  const scale = fitScale(cb, inner.w - MARGIN * 2, availH) * appearance.scale;
  let destW = Math.round(cb.w * scale);
  let destH = Math.round(cb.h * scale);
  // 진화 중엔 펫 픽셀 크기를 고정(창이 커져도 안 커지게). idle 로 돌아오면 해제.
  if (evoPhase === "idle") {
    frozenDestRef.current = null;
  } else {
    if (!frozenDestRef.current) frozenDestRef.current = { w: destW, h: destH };
    destW = frozenDestRef.current.w;
    destH = frozenDestRef.current.h;
  }

  // 진화 가능 + 평상시(idle)일 때만 푸른 글로우 오라를 띄운다.
  const evoReady = canEvolve(SPECIES, pet.form, pet.exp) && evoPhase === "idle";
  // 상태창은 평상시(idle)에만 보인다 — 진화 동안엔 창을 안 건드리고 렌더에서만 숨겨 펫이 중앙에 오게 한다.
  // (availH 는 showStatus 기준 유지 → 숨김 첫 렌더에서 펫 frozen 크기가 평상시와 동일하게 잡힌다.)
  const panelOpen = showStatus && evoPhase === "idle";

  // 진화 페이즈별 펫 필터: flash=화이트아웃, charge=골드 글로우, 그 외=평소(placeholder 색조).
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
        if (!resizing) void showMenu();
      }}
      className="relative flex h-screen w-screen items-center justify-center bg-transparent"
      style={{ userSelect: "none", paddingTop: panelOpen ? PANEL_H : 0 }}
    >
      {panelOpen && <StatusPanel pet={pet} species={SPECIES} />}

      {evoReady && <EvolveReadyFx />}

      <EvolutionFx phase={evoPhase} />

      <div style={{ position: "relative", zIndex: 1, opacity: evoPhase === "hidden" ? 0 : 1 }}>
        <Pet
          img={img}
          cell={cell}
          columns={activeManifest.columns}
          cellSize={activeManifest.frameSize}
          box={box}
          destW={destW}
          destH={destH}
          filter={petFilter}
        />
      </div>

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
