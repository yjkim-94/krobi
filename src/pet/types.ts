export type AnimationName = "idle" | "eat" | "happy" | "sad";

export interface AnimationDef {
  /** 재생 순서대로의 프레임 base 이름 (확장자 제외) */
  frames: string[];
  fps: number;
  loop: boolean;
  /** loop:false 종료 후 전환할 애니 (선택) */
  then?: AnimationName;
}

export interface PetManifest {
  id: string;
  frameSize: number;
  displayScale: number;
  animations: Record<AnimationName, AnimationDef>;
}
