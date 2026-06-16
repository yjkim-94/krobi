import type { CSSProperties } from "react";

const ORBS = 7;

/**
 * 진화 가능 상태 신호: 펫 뒤에 푸른 글로우 동그라미들이 몽글몽글 떠다닌다.
 * 펫(zIndex:1) 뒤(zIndex:0)에 깔려 실루엣 주변 오라처럼 보이고, 얼굴은 가리지 않는다.
 */
export function EvolveReadyFx() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      {Array.from({ length: ORBS }).map((_, i) => {
        const ang = (i / ORBS) * Math.PI * 2 + 0.4;
        const r = 24 + (i % 3) * 4; // 중심에서의 거리(%) — 경계 글로우 잘림 방지로 안쪽에만
        const size = 9 + (i % 4) * 4; // px
        // 떠다니는 방향(자기 자리에서 살짝 흔들림)
        const fx = Math.cos(ang * 1.7) * 4;
        const fy = Math.sin(ang * 1.3) * 4;
        const hue = Math.round((i / ORBS) * 360); // 무지개색: 동그라미마다 다른 색조
        const style: CSSProperties = {
          position: "absolute",
          left: `${50 + Math.cos(ang) * r}%`,
          top: `${50 + Math.sin(ang) * r}%`,
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          borderRadius: "50%",
          background: `radial-gradient(circle, hsla(${hue},100%,80%,0.95) 0%, hsla(${hue},95%,65%,0.55) 45%, hsla(${hue},90%,60%,0) 75%)`,
          boxShadow: `0 0 8px hsla(${hue},100%,70%,0.8), 0 0 14px hsla(${hue},95%,60%,0.5)`,
          filter: "blur(0.5px)",
          animation: `krobi-orb-float ${2.6 + (i % 3) * 0.7}s ease-in-out infinite`,
          animationDelay: `${-i * 0.45}s`,
          ["--fx" as string]: `${fx}px`,
          ["--fy" as string]: `${fy}px`,
        } as CSSProperties;
        return <span key={i} style={style} />;
      })}
    </div>
  );
}
