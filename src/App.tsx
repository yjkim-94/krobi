import { useEffect, useRef, useState } from "react";
import { load, type Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { Menu } from "@tauri-apps/api/menu";
import "./App.css";
import type { AnimationName } from "./pet/types";
import { baseAnimation } from "./pet/animation";
import { useWindowDrag } from "./pet/useWindowDrag";
import { useActiveAppTracker } from "./pet/useActiveAppTracker";
import { fitWindowSize, boxSize } from "./pet/contentBounds";
import { PetSlot } from "./pet/PetSlot";
import { defaultPosition, resolveDropPosition, layoutBounds, type LayoutState, type Rect } from "./pet/layout";
import { getSpeciesDef } from "./pet/speciesRegistry";
import { migrateAppData, type AppData } from "./pet/appData";
import { applyTickAll, evolveSpecies, resetSpecies, feedSpecies, setDisplayForm } from "./pet/appDataOps";
import { canEvolve } from "./pet/petState";
import { StatusPanel } from "./ui/StatusPanel";
import { EvolutionFx, type EvoPhase } from "./ui/EvolutionFx";
import { ResizeOverlay } from "./ui/ResizeOverlay";

const STORE_FILE = "krobi_data.json";
const VERSION = "3.0.0";
const HUNGER_RATE = 1; // 포만감: 분당 -1
const EXP_GAIN = 10; // 경험치: 분당 +10 (잠정)
const TENDENCY_GAIN = 10; // 활성 앱 1회 감지당 +10 (잠정)
const APP_POLL_MS = 30_000; // 활성 앱 폴링 주기
const TICK_MS = 60_000;
const MARGIN = 12; // 펫 주변 여백(px)
const GAP = 16; // 펫 기본 배치 시 펫 사이 간격(px)
const PANEL_H = 96; // 펫상태 패널을 위해 창에 더할 높이(px)
const PANEL_W = 170; // 펫상태 패널이 잘리지 않을 최소 창 너비(px)
const EVO_PAD = 90; // 진화 중 섬광이 퍼질 투명 여백(px, 사방). 펫 크기/위치는 고정.

const delay = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
// 다음 paint 까지 기다린다(상태 변경이 화면에 실제 반영된 뒤 다음 단계로). rAF 2틱 = 한 번은 확실히 그려짐.
const nextPaint = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

// 창 리사이즈가 끝나고 레이아웃이 화면에 반영될 때까지 기다린다.
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
  const [appData, setAppData] = useState<AppData | null>(null);
  const [layout, setLayout] = useState<LayoutState>({ positions: [] });
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [oneShots, setOneShots] = useState<Record<string, AnimationName | null>>({});
  const [focusedSpeciesId, setFocusedSpeciesId] = useState<string | null>(null);
  const [evolvingSpeciesId, setEvolvingSpeciesId] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [evoPhase, setEvoPhase] = useState<EvoPhase>("idle");
  const [dragLive, setDragLive] = useState<{ speciesId: string; dx: number; dy: number } | null>(null);
  const evoBoxRef = useRef<[number, number, number, number] | null>(null); // 진화 전 창 (x,y,w,h)

  async function persistAll(data: AppData, lay: LayoutState) {
    const store = storeRef.current;
    if (!store) return;
    await store.set("version", VERSION);
    await store.set("appData", data);
    await store.set("layout", lay);
    await store.save();
  }

  // 펫 데이터 로드 + 마이그레이션 + 오프라인 보정 + 감소/증가 틱.
  useEffect(() => {
    let intervalId: number | undefined;
    (async () => {
      const store = await load(STORE_FILE, { defaults: {}, autoSave: false });
      storeRef.current = store;
      const krombiDef = getSpeciesDef("krombi")!;
      const storedAppData = await store.get("appData");
      const storedPet = await store.get("pet");
      let current = migrateAppData(storedAppData ?? { pet: storedPet }, krombiDef);

      const referenceSlot = current.slots[0];
      const lastUpdated = referenceSlot ? current.pets[referenceSlot.speciesId]?.instance.last_updated : undefined;
      const now = Date.now();
      const last = lastUpdated ? new Date(lastUpdated).getTime() : now;
      const elapsedMin = Math.max(0, Math.floor((now - last) / 60_000));
      for (let i = 0; i < elapsedMin; i++) {
        current = applyTickAll(current, { satietyRate: HUNGER_RATE, expGain: EXP_GAIN });
      }

      const storedLayout = (await store.get("layout")) as LayoutState | undefined;
      const lay = storedLayout ?? { positions: [] };

      await persistAll(current, lay);
      setAppData(current);
      setLayout(lay);
      setFocusedSpeciesId(current.slots[0]?.speciesId ?? null);

      intervalId = window.setInterval(() => {
        setAppData((prev) => {
          if (!prev) return prev;
          const next = applyTickAll(prev, { satietyRate: HUNGER_RATE, expGain: EXP_GAIN });
          void persistAll(next, layoutRef.current);
          return next;
        });
      }, TICK_MS);
    })();
    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  // 활성 앱 감지 → 현재 표시 중인 모든 종의 성향 게이지 증가(분류) 또는 미분류 카운트.
  useActiveAppTracker((key, appName) => {
    setAppData((prev) => {
      if (!prev) return prev;
      const pets = { ...prev.pets };
      for (const slot of prev.slots) {
        const progress = pets[slot.speciesId];
        if (!progress) continue;
        if (key) {
          pets[slot.speciesId] = {
            ...progress,
            instance: {
              ...progress.instance,
              tendencies: { ...progress.instance.tendencies, [key]: progress.instance.tendencies[key] + TENDENCY_GAIN },
            },
          };
        } else {
          pets[slot.speciesId] = {
            ...progress,
            instance: {
              ...progress.instance,
              unknownApps: {
                ...progress.instance.unknownApps,
                [appName]: (progress.instance.unknownApps[appName] ?? 0) + 1,
              },
            },
          };
        }
      }
      const next = { ...prev, pets };
      void persistAll(next, layoutRef.current);
      return next;
    });
  }, APP_POLL_MS);

  // 슬롯에 위치가 없는 펫(막 추가됐거나 막 로드된 펫)에 기본 위치를 배정.
  // 그 펫의 크기가 측정될 때까지(= sizes 에 들어올 때까지) 기다린다.
  useEffect(() => {
    if (!appData) return;
    const missing = appData.slots.filter((s) => !layout.positions.some((p) => p.speciesId === s.speciesId));
    const ready = missing.filter((s) => sizes[s.speciesId]);
    if (ready.length === 0) return;
    setLayout((prev) => {
      let positions = prev.positions;
      for (const slot of ready) {
        const existingRects: Rect[] = positions
          .map((p) => {
            const sz = sizes[p.speciesId];
            return sz ? { x: p.x, y: p.y, w: sz.w, h: sz.h } : null;
          })
          .filter((r): r is Rect => r !== null);
        const size = sizes[slot.speciesId];
        const pt = defaultPosition(existingRects, size, GAP);
        positions = [...positions, { speciesId: slot.speciesId, ...pt }];
      }
      const next = { positions };
      void persistAll(appData, next);
      return next;
    });
  }, [appData, sizes, layout]);

  // 창 크기는 현재 보이는 펫들의 배치+크기(+펫상태 패널)로부터 다시 계산한다(자동 맞춤).
  // appData 는 분당 틱마다도 새 객체가 되므로, 매분 창이 깜빡 재계산되는 걸 막기 위해
  // "슬롯 구성"만 안정적인 문자열 키(slotsKey)로 뽑아 deps 에 넣는다 — appData 자체는 deps 에서 뺀다
  // (틱은 pets 의 satiety/exp 만 바꾸고 slots 배열은 그대로이므로, effect 가 다시 안 돌아도
  // 안전하게 "약간 오래된" appData.slots 를 읽게 된다 — 내용이 어차피 같다).
  const slotsKey = appData ? appData.slots.map((s) => s.speciesId).join(",") : "";
  useEffect(() => {
    if (!appData) return;
    const rects: Rect[] = appData.slots
      .map((slot) => {
        const pos = layout.positions.find((p) => p.speciesId === slot.speciesId);
        const size = sizes[slot.speciesId];
        if (!pos || !size) return null;
        const live = dragLive && dragLive.speciesId === slot.speciesId ? dragLive : null;
        const x = live ? pos.x + live.dx : pos.x;
        const y = live ? pos.y + live.dy : pos.y;
        return { x, y, w: size.w, h: size.h };
      })
      .filter((r): r is Rect => r !== null);
    if (rects.length === 0 || rects.length !== appData.slots.length) return; // 아직 전부 준비 안 됨
    const bounds = layoutBounds(rects);
    const content = bounds ? boxSize(bounds) : { w: 0, h: 0 };
    const fitted = fitWindowSize(content, 1, MARGIN);
    const width = Math.max(fitted.width, showStatus ? PANEL_W : 0);
    const height = fitted.height + (showStatus ? PANEL_H : 0);
    void getCurrentWindow().setSize(new LogicalSize(width, height));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsKey, layout, sizes, showStatus, dragLive]);

  function feedAction(speciesId: string) {
    setOneShots((prev) => ({ ...prev, [speciesId]: "eat" }));
    setAppData((prev) => {
      if (!prev) return prev;
      const next = feedSpecies(prev, speciesId);
      void persistAll(next, layoutRef.current);
      return next;
    });
  }

  function resetAction(speciesId: string) {
    setAppData((prev) => {
      if (!prev) return prev;
      const reset = resetSpecies(prev, speciesId);
      const next = setDisplayForm(reset, speciesId, "stage1");
      void persistAll(next, layoutRef.current);
      return next;
    });
  }

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

  function evolveAction(speciesId: string) {
    if (!appData || evoPhase !== "idle") return;
    const species = getSpeciesDef(speciesId);
    const progress = appData.pets[speciesId];
    if (!species || !progress || !canEvolve(species, progress.instance.form, progress.instance.exp)) return;
    setEvolvingSpeciesId(speciesId);
    void (async () => {
      setEvoPhase("hidden");
      await nextPaint();
      const grown = waitForResizeSettled();
      await growForEvo();
      await grown;
      setEvoPhase("charge");
      await delay(1350);
      setEvoPhase("flash");
      setAppData((prev) => {
        if (!prev) return prev;
        const evolved = evolveSpecies(prev, speciesId, species);
        if (evolved === prev) return prev;
        const next = setDisplayForm(evolved, speciesId, evolved.pets[speciesId].instance.form);
        void persistAll(next, layoutRef.current);
        return next;
      });
      await delay(750);
      setEvoPhase("reveal");
      await delay(1650);
      const restored = waitForResizeSettled();
      await restoreFromEvo();
      await restored;
      setEvoPhase("idle");
      setEvolvingSpeciesId(null);
      setOneShots((prev) => ({ ...prev, [speciesId]: "happy" }));
    })();
  }

  function toggleStatus() {
    setShowStatus((prev) => !prev);
  }

  async function showMenu(speciesId: string) {
    setFocusedSpeciesId(speciesId);
    const species = getSpeciesDef(speciesId);
    const progress = appData?.pets[speciesId];
    const evolvable =
      species && progress ? canEvolve(species, progress.instance.form, progress.instance.exp) && evoPhase === "idle" : false;
    const menu = await Menu.new({
      items: [
        { id: "feed", text: "밥주기", action: () => feedAction(speciesId) },
        { id: "status", text: showStatus ? "펫상태 숨기기" : "펫상태", action: () => toggleStatus() },
        { id: "evolve", text: "진화하기", enabled: evolvable, action: () => evolveAction(speciesId) },
        { id: "resize", text: "크기 조절", action: () => setResizing(true) },
        { id: "reset", text: "초기화", action: () => resetAction(speciesId) },
      ],
    });
    await menu.popup();
  }

  function commitSize() {
    setResizing(false);
  }

  function handleDrop(speciesId: string, dx: number, dy: number) {
    setDragLive(null);
    if (!appData) return;
    const pos = layout.positions.find((p) => p.speciesId === speciesId);
    const size = sizes[speciesId];
    if (!pos || !size) return;
    const dropped: Rect = { x: pos.x + dx, y: pos.y + dy, w: size.w, h: size.h };
    const others: Rect[] = appData.slots
      .filter((s) => s.speciesId !== speciesId)
      .map((s) => {
        const p = layout.positions.find((pp) => pp.speciesId === s.speciesId);
        const sz = sizes[s.speciesId];
        return p && sz ? { x: p.x, y: p.y, w: sz.w, h: sz.h } : null;
      })
      .filter((r): r is Rect => r !== null);
    const resolved = resolveDropPosition(dropped, others);
    setLayout((prev) => {
      const positions = prev.positions.map((p) => (p.speciesId === speciesId ? { ...p, ...resolved } : p));
      const next = { positions };
      void persistAll(appData, next);
      return next;
    });
  }

  const backgroundDrag = useWindowDrag(() => {});

  if (!appData) return null;

  const rects: Rect[] = appData.slots
    .map((slot) => {
      const pos = layout.positions.find((p) => p.speciesId === slot.speciesId);
      const size = sizes[slot.speciesId];
      return pos && size ? { x: pos.x, y: pos.y, w: size.w, h: size.h } : null;
    })
    .filter((r): r is Rect => r !== null);
  const bounds = layoutBounds(rects);
  const originOffset = bounds ? { x: bounds.minX, y: bounds.minY } : { x: 0, y: 0 };

  return (
    <div
      onMouseDown={backgroundDrag.onMouseDown}
      onMouseMove={backgroundDrag.onMouseMove}
      onMouseUp={backgroundDrag.onMouseUp}
      className="relative h-screen w-screen bg-transparent"
      style={{ userSelect: "none", paddingTop: showStatus ? PANEL_H : 0 }}
    >
      {showStatus && focusedSpeciesId && appData.pets[focusedSpeciesId] && getSpeciesDef(focusedSpeciesId) && (
        <StatusPanel pet={appData.pets[focusedSpeciesId].instance} species={getSpeciesDef(focusedSpeciesId)!} />
      )}

      <EvolutionFx phase={evoPhase} />

      {appData.slots.map((slot) => {
        const progress = appData.pets[slot.speciesId];
        if (!progress) return null;
        const species = getSpeciesDef(slot.speciesId);
        const pos = layout.positions.find((p) => p.speciesId === slot.speciesId) ?? { x: 0, y: 0 };
        const base = baseAnimation(progress.instance.status.satiety);
        const evoReady = species
          ? canEvolve(species, progress.instance.form, progress.instance.exp) && evoPhase === "idle"
          : false;
        return (
          <PetSlot
            key={slot.speciesId}
            speciesId={slot.speciesId}
            form={slot.displayForm}
            base={base}
            oneShot={oneShots[slot.speciesId] ?? null}
            onOneShotEnd={() => setOneShots((prev) => ({ ...prev, [slot.speciesId]: null }))}
            position={pos}
            originOffset={originOffset}
            margin={MARGIN}
            evoPhase={slot.speciesId === evolvingSpeciesId ? evoPhase : "idle"}
            evoReady={evoReady}
            onSizeReady={(w, h) =>
              setSizes((prev) =>
                prev[slot.speciesId]?.w === w && prev[slot.speciesId]?.h === h ? prev : { ...prev, [slot.speciesId]: { w, h } },
              )
            }
            onClick={() => setOneShots((prev) => ({ ...prev, [slot.speciesId]: "happy" }))}
            onContextMenu={() => {
              if (!resizing) void showMenu(slot.speciesId);
            }}
            onDragLive={(dx, dy) => setDragLive({ speciesId: slot.speciesId, dx, dy })}
            onDrop={(dx, dy) => handleDrop(slot.speciesId, dx, dy)}
          />
        );
      })}

      {resizing && (
        <ResizeOverlay
          onDone={(commit) => {
            if (commit) commitSize();
            else setResizing(false);
          }}
        />
      )}
    </div>
  );
}

export default App;
