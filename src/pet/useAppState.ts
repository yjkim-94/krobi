import { useEffect, useRef, useState } from "react";
import { load, type Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { Menu } from "@tauri-apps/api/menu";
import type { AnimationName } from "./types";
import { useWindowDrag } from "./useWindowDrag";
import { useActiveAppTracker } from "./useActiveAppTracker";
import { fitWindowSize, boxSize } from "./contentBounds";
import { defaultPosition, resolveDropPosition, layoutBounds, type LayoutState, type Rect } from "./layout";
import { getSpeciesDef } from "./speciesRegistry";
import { migrateAppData, type AppData } from "./appData";
import { applyTickAll, feedSpecies, evolveAndSync, resetAndSync } from "./appDataOps";
import { canEvolve } from "./petState";
import type { EvoPhase } from "../ui/EvolutionFx";

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
const nextPaint = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

function waitForResizeSettled(timeoutMs = 800): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("resize", onResize);
      resolve();
    };
    const onResize = () => requestAnimationFrame(() => requestAnimationFrame(finish));
    window.addEventListener("resize", onResize);
    window.setTimeout(finish, timeoutMs);
  });
}

export function useAppState() {
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
  const evoBoxRef = useRef<[number, number, number, number] | null>(null);

  async function persistAll(data: AppData, lay: LayoutState) {
    const store = storeRef.current;
    if (!store) return;
    await store.set("version", VERSION);
    await store.set("appData", data);
    await store.set("layout", lay);
    await store.save();
  }

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
    if (rects.length === 0 || rects.length !== appData.slots.length) return;
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
      const next = resetAndSync(prev, speciesId);
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
        const next = evolveAndSync(prev, speciesId, species);
        if (next === prev) return prev;
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

  function handleDragLive(speciesId: string, dx: number, dy: number) {
    setDragLive({ speciesId, dx, dy });
  }

  function reportSize(speciesId: string, w: number, h: number) {
    setSizes((prev) => (prev[speciesId]?.w === w && prev[speciesId]?.h === h ? prev : { ...prev, [speciesId]: { w, h } }));
  }

  function clearOneShot(speciesId: string) {
    setOneShots((prev) => ({ ...prev, [speciesId]: null }));
  }

  function triggerHappy(speciesId: string) {
    setOneShots((prev) => ({ ...prev, [speciesId]: "happy" }));
  }

  const backgroundDrag = useWindowDrag(() => {});

  return {
    appData,
    layout,
    sizes,
    oneShots,
    focusedSpeciesId,
    evolvingSpeciesId,
    resizing,
    showStatus,
    evoPhase,
    backgroundDrag,
    showMenu,
    handleDrop,
    handleDragLive,
    reportSize,
    clearOneShot,
    triggerHappy,
    commitSize,
    setResizing,
    MARGIN,
    PANEL_H,
  };
}
