import type { CSSProperties } from "react";

export type EvoPhase = "idle" | "hidden" | "charge" | "flash" | "reveal";

const SPARKS = 12;

/** 진화 연출 오버레이: 골드 파티클 버스트 + 흰 섬광. (화이트아웃은 펫 필터로 별도 처리) */
export function EvolutionFx({ phase }: { phase: EvoPhase }) {
  // hidden: 창 리사이즈로 화면이 한 프레임 끌리는 동안엔 글로우도 같이 숨긴다(따라 튀지 않게).
  if (phase === "idle" || phase === "hidden") return null;

  const flashOpacity = phase === "flash" ? 1 : phase === "reveal" ? 0 : 0.15;
  const showSparks = phase === "charge" || phase === "flash";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden", // 원형 섬광이 창 밖으로 안 나가게(어차피 창보다 작음)
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 0, // 펫(zIndex:1) 뒤에 깔려 캔버스 위에 겹치지 않게 → 사각형 seam 방지
      }}
    >
      {/* 창보다 작은 고정 원형 섬광: 자기 반경 안에서 완전 투명해져 가장자리에 직선 잘림이 없다. */}
      <div
        style={{
          position: "absolute",
          width: "88vmin",
          height: "88vmin",
          borderRadius: "50%",
          background:
            "radial-gradient(circle closest-side, rgba(255,252,240,1) 0%, rgba(255,224,150,0.75) 32%, rgba(255,200,120,0.25) 52%, rgba(255,200,120,0) 66%)",
          opacity: flashOpacity,
          transition: phase === "reveal" ? "opacity 550ms ease-out" : "opacity 220ms ease-in",
        }}
      />
      {showSparks &&
        Array.from({ length: SPARKS }).map((_, i) => {
          const ang = (i / SPARKS) * Math.PI * 2;
          const dist = 22 + (i % 3) * 6; // vmin — 창 안에 머물도록
          const sparkStyle: CSSProperties = {
            position: "absolute",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: i % 2 ? "#ffe08a" : "#fff6d5",
            boxShadow: "0 0 6px #ffd36b",
            animation: "krobi-spark-burst 700ms ease-out forwards",
            // CSS 변수로 분출 방향 전달(vmin 단위)
            ["--dx" as string]: `${Math.cos(ang) * dist}vmin`,
            ["--dy" as string]: `${Math.sin(ang) * dist}vmin`,
          } as CSSProperties;
          return <span key={i} style={sparkStyle} />;
        })}
    </div>
  );
}
