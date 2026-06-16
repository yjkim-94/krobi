export type AnimationName = "idle" | "eat" | "happy" | "sad";

export interface AnimationDef {
  /** 재생 순서대로의 시트 셀 인덱스 (좌→우, 위→아래) */
  frames: number[];
  fps: number;
  loop: boolean;
  /** loop:false 종료 후 전환할 애니 (선택) */
  then?: AnimationName;
}

export interface PetManifest {
  id: string;
  frameSize: number;
  displayScale: number;
  /** 폼 폴더 내 스프라이트 시트 파일명 */
  sheet: string;
  /** 시트 격자의 열 수 (셀 인덱스 → 행/열 변환에 사용) */
  columns: number;
  animations: Record<AnimationName, AnimationDef>;
}

/** 도감(catalog.json) — 컨셉 중복방지 인덱스 */
export interface CatalogEntry {
  id: string;
  displayName: string;
  archetype: string;
  concept: string;
  claimedMotifs: string[];
  claimedColors: string[];
  /** 도달 가능 스타일 분기 = species.json 의 branchWhitelist 미러 */
  branches: string[];
}

export interface Catalog {
  species: CatalogEntry[];
}

/** species.json 의 한 형태(노드) */
export interface SpeciesForm {
  frameSize: number;
  /** 부모 노드 키(stage1 은 없음) */
  from?: string;
  /** 분기 조건 — stat 은 업무 카테고리(별도 spec), gte 는 placeholder 임계 */
  condition?: { stat: string; gte: number };
}

/** species.json — 종별 진화 트리 + 진화 공식 */
export interface SpeciesDef {
  id: string;
  archetype: string;
  /** 이 종이 도달 가능한 스타일(공식). 아키타입에 맞는 값만. */
  branchWhitelist: string[];
  forms: Record<string, SpeciesForm>;
}
