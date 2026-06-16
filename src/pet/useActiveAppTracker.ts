import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { classifyApp } from "./appCategories";
import type { TendencyKey } from "./petState";

type FrontmostApp = { name: string; bundle_id: string };

/**
 * intervalMs 마다 활성 앱을 확인해 onSample 호출.
 * 분류되면 key, 모르는 앱이면 key=null (이름은 항상 전달).
 */
export function useActiveAppTracker(
  onSample: (key: TendencyKey | null, appName: string) => void,
  intervalMs = 30_000,
) {
  const ref = useRef(onSample);
  ref.current = onSample;

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const app = await invoke<FrontmostApp | null>("get_frontmost_app");
        if (cancelled || !app || !app.name) return;
        ref.current(classifyApp(app.name, app.bundle_id), app.name);
      } catch {
        /* 비-macOS 또는 일시 오류는 무시 */
      }
    };
    void tick();
    const id = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [intervalMs]);
}
