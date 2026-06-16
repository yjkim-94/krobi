import { useEffect, useRef, useState } from "react";
import { load, type Store } from "@tauri-apps/plugin-store";
import "./App.css";
import manifest from "./assets/pets/krobi/stage1/manifest.json";
import type { AnimationName, PetManifest } from "./pet/types";
import { baseAnimation } from "./pet/animation";
import { krobiFrameUrls } from "./pet/frameUrls";
import { usePetAnimation } from "./pet/usePetAnimation";
import { Pet } from "./pet/Pet";

const PET = manifest as PetManifest;

const STORE_FILE = "krobi_data.json";
const VERSION = "1.0.0";

// 분당 감소율 (60초 틱 = 1분)
const HUNGER_RATE = 1; // 시장기: 분당 -1
const CLEAN_RATE = 0.5; // 청결: 분당 -0.5
const TICK_MS = 60_000;

type Status = { hunger: number; cleanliness: number };
type Pet = {
  name: string;
  level: number;
  status: Status; // 보강 #6: float로 저장
  last_updated: string; // ISO8601 UTC
};

const clampMin0 = (v: number) => Math.max(0, v);
const clampMax100 = (v: number) => Math.min(100, v);

function defaultPet(): Pet {
  return {
    name: "크로비",
    level: 1,
    status: { hunger: 100, cleanliness: 100 },
    last_updated: new Date().toISOString(),
  };
}

function App() {
  const storeRef = useRef<Store | null>(null);
  const [pet, setPet] = useState<Pet | null>(null);
  const [oneShot, setOneShot] = useState<AnimationName | null>(null);

  // 보강 #7: set 후 반드시 save() 해야 디스크 반영
  async function persist(next: Pet) {
    const store = storeRef.current;
    if (!store) return;
    await store.set("version", VERSION);
    await store.set("pet", next);
    await store.save();
  }

  useEffect(() => {
    let intervalId: number | undefined;

    (async () => {
      // 보강 #8: v2 방식 load()
      const store = await load(STORE_FILE, { defaults: {}, autoSave: false });
      storeRef.current = store;

      // 없으면 자동 생성
      let current = (await store.get<Pet>("pet")) ?? defaultPet();

      // 오프라인 보정: (now - last_updated) 경과 분만큼 즉시 차감 후 clamp(0)
      const now = Date.now();
      const last = new Date(current.last_updated).getTime();
      const elapsedMin = Math.max(0, Math.floor((now - last) / 60_000));
      if (elapsedMin > 0) {
        current = {
          ...current,
          status: {
            hunger: clampMin0(current.status.hunger - elapsedMin * HUNGER_RATE),
            cleanliness: clampMin0(
              current.status.cleanliness - elapsedMin * CLEAN_RATE,
            ),
          },
          last_updated: new Date(now).toISOString(),
        };
      }

      await persist(current);
      setPet(current);

      // Decay 틱: 60초마다 감소 + 저장
      intervalId = window.setInterval(() => {
        setPet((prev) => {
          if (!prev) return prev;
          const next: Pet = {
            ...prev,
            status: {
              hunger: clampMin0(prev.status.hunger - HUNGER_RATE),
              cleanliness: clampMin0(prev.status.cleanliness - CLEAN_RATE),
            },
            last_updated: new Date().toISOString(),
          };
          void persist(next);
          return next;
        });
      }, TICK_MS);
    })();

    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  function feed(e: React.MouseEvent) {
    // 보강 #5: 버튼은 드래그 막고 동작 실행
    e.stopPropagation();
    setOneShot("eat");
    setPet((prev) => {
      if (!prev) return prev;
      const next: Pet = {
        ...prev,
        status: {
          ...prev.status,
          hunger: clampMax100(prev.status.hunger + 20),
        },
        last_updated: new Date().toISOString(),
      };
      void persist(next);
      return next;
    });
  }

  function clean(e: React.MouseEvent) {
    e.stopPropagation();
    setOneShot("happy");
    setPet((prev) => {
      if (!prev) return prev;
      const next: Pet = {
        ...prev,
        status: {
          ...prev.status,
          cleanliness: clampMax100(prev.status.cleanliness + 20),
        },
        last_updated: new Date().toISOString(),
      };
      void persist(next);
      return next;
    });
  }

  // 애니메이션: 기본 상태(idle/sad)는 스탯으로 결정, oneShot(eat/happy)은 1회 재생
  const base: AnimationName = pet
    ? baseAnimation(pet.status.hunger, pet.status.cleanliness)
    : "idle";
  const frameUrl = usePetAnimation(PET, krobiFrameUrls, base, oneShot, () =>
    setOneShot(null),
  );

  if (!pet) return null;

  // 보강 #6: 표시만 반올림
  const hunger = Math.round(pet.status.hunger);
  const cleanliness = Math.round(pet.status.cleanliness);

  return (
    <div
      data-tauri-drag-region
      className="flex h-screen w-screen flex-col items-center justify-between rounded-2xl bg-sky-100/80 p-2 backdrop-blur-sm"
    >
      {/* 펫 */}
      <div
        data-tauri-drag-region
        className="flex flex-1 items-center justify-center"
      >
        <Pet frameUrl={frameUrl} size={PET.frameSize * PET.displayScale} />
      </div>

      {/* 상태 바 */}
      <div data-tauri-drag-region className="w-full space-y-1.5">
        <Bar label="🍚" value={hunger} color="bg-orange-400" />
        <Bar label="🛁" value={cleanliness} color="bg-sky-400" />
      </div>

      {/* 버튼 */}
      <div className="mt-2 flex gap-2">
        <button
          onClick={feed}
          className="rounded-lg bg-orange-400 px-2.5 py-1 text-xs font-bold text-white shadow active:scale-95"
        >
          밥주기
        </button>
        <button
          onClick={clean}
          className="rounded-lg bg-sky-400 px-2.5 py-1 text-xs font-bold text-white shadow active:scale-95"
        >
          청소하기
        </button>
      </div>
    </div>
  );
}

function Bar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-4 text-xs">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/70">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-7 text-right text-[10px] font-semibold text-slate-600">
        {value}
      </span>
    </div>
  );
}

export default App;
