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

/** A reachable evolution branch. Key (e.g. "maker") is used in form names. */
export interface SpeciesBranch {
  /** in-game display name of the branch's evolved form */
  label: string;
  /** the user tendency this branch aligns with (display string) */
  tendency: string;
}

/** species.json 의 한 형태(노드) */
export interface SpeciesForm {
  frameSize: number;
  /** 부모 노드 키(stage1 은 없음) */
  from?: string;
  /** 이 폼이 속한 분기 키 (stage1 은 없음) */
  branch?: string;
  /** 이 폼에서 다음 단계로 진화하는 데 필요한 EXP. 없으면 종착(진화 불가). */
  expToEvolve?: number;
}

/** species.json — 종별 진화 트리 */
export interface SpeciesDef {
  id: string;
  archetype: string;
  /** 분기 키 → 분기 정의 (maker/sage/wild) */
  branches: Record<string, SpeciesBranch>;
  forms: Record<string, SpeciesForm>;
}
