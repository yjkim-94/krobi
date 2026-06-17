import type { CSSProperties } from "react";
import type { PetData } from "../pet/petState";
import type { SpeciesDef } from "../pet/types";
import { dominantTendency } from "../pet/petState";

function Bar({ label, value, max, color, highlight }: {
  label: string; value: number; max: number; color: string; highlight?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ marginBottom: 3 }}>
      <div style={{ fontSize: 9, lineHeight: "10px", color: highlight ? "#fff" : "#cbd5e1", fontWeight: highlight ? 700 : 400 }}>
        {label}
      </div>
      <div style={{ height: 6, background: "rgba(0,0,0,0.45)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

function panelStyle(anchor?: { x: number; y: number; width: number } | null): CSSProperties {
  const shared: CSSProperties = {
    width: 150, padding: "6px 8px", borderRadius: 8,
    background: "rgba(17,24,39,0.82)", color: "#fff", fontFamily: "system-ui",
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)", pointerEvents: "none",
  };
  if (anchor) {
    return {
      ...shared,
      position: "absolute",
      left: anchor.x + anchor.width / 2,
      top: anchor.y - 8,
      transform: "translate(-50%, -100%)", // 펫의 머리 위, 가로 중앙
    };
  }
  return { ...shared, position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)" };
}

/** 펫 머리 위 상태 패널: 포만감 / 경험치 / 성향 3개. */
export function StatusPanel({
  pet,
  species,
  anchor,
}: {
  pet: PetData;
  species: SpeciesDef;
  anchor?: { x: number; y: number; width: number } | null;
}) {
  const expMax = (species.forms[pet.form]?.expToEvolve ?? pet.exp) || 1;
  const terminal = species.forms[pet.form]?.expToEvolve == null;
  const full = !terminal && pet.exp >= expMax;
  const dom = dominantTendency(pet.tendencies);
  return (
    <div style={panelStyle(anchor)}>
      <Bar label="포만감" value={pet.status.satiety} max={100} color="#f59e0b" />
      <Bar label={full ? "경험치 — 진화 가능!" : "경험치"} value={terminal ? 1 : pet.exp} max={terminal ? 1 : expMax} color={full ? "#22c55e" : "#38bdf8"} />
      <Bar label="🛠 생산·창작" value={pet.tendencies.maker} max={100} color="#fb7185" highlight={dom === "maker"} />
      <Bar label="🔍 탐구·학습" value={pet.tendencies.sage} max={100} color="#60a5fa" highlight={dom === "sage"} />
      <Bar label="🎮 유희·감상" value={pet.tendencies.wild} max={100} color="#c084fc" highlight={dom === "wild"} />
    </div>
  );
}
