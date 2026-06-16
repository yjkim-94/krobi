import type { SpeciesDef } from "./types";

export type TendencyKey = "maker" | "sage" | "wild";
export type Tendencies = Record<TendencyKey, number>;
export type Status = { satiety: number };

export type PetData = {
  name: string;
  form: string; // 현재 폼 키 ("stage1" | "stage2-maker" ...)
  status: Status;
  exp: number; // 시간으로 증가, 진화 시 0
  tendencies: Tendencies; // 활성 앱 감지로 증가
  unknownApps: Record<string, number>; // 미분류 앱 카운트
  last_updated: string;
};

export const TENDENCY_KEYS: TendencyKey[] = ["maker", "sage", "wild"];

const clampMin0 = (v: number) => Math.max(0, v);

export function defaultPet(): PetData {
  return {
    name: "크롬비",
    form: "stage1",
    status: { satiety: 100 },
    exp: 0,
    tendencies: { maker: 0, sage: 0, wild: 0 },
    unknownApps: {},
    last_updated: new Date().toISOString(),
  };
}

/** 구버전 저장(level/hunger) → 신버전(form/exp/tendencies)으로 마이그레이션. */
export function migrate(raw: unknown): PetData {
  const base = defaultPet();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const status = (r.status ?? {}) as Record<string, unknown>;
  const satiety =
    typeof status.satiety === "number"
      ? status.satiety
      : typeof status.hunger === "number"
        ? status.hunger
        : 100;
  const t = (r.tendencies ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  return {
    name: typeof r.name === "string" ? r.name : base.name,
    form: typeof r.form === "string" ? r.form : base.form,
    status: { satiety },
    exp: typeof r.exp === "number" ? r.exp : 0,
    tendencies: { maker: num(t.maker), sage: num(t.sage), wild: num(t.wild) },
    unknownApps:
      r.unknownApps && typeof r.unknownApps === "object"
        ? (r.unknownApps as Record<string, number>)
        : {},
    last_updated:
      typeof r.last_updated === "string" ? r.last_updated : base.last_updated,
  };
}

/** 한 틱: 포만감 감소 + EXP 증가. last_updated 갱신. */
export function applyTick(
  pet: PetData,
  rates: { satietyRate: number; expGain: number },
): PetData {
  return {
    ...pet,
    status: { satiety: clampMin0(pet.status.satiety - rates.satietyRate) },
    exp: pet.exp + rates.expGain,
    last_updated: new Date().toISOString(),
  };
}

/** 가장 높은 성향 키. 전부 동률이면 maker. */
export function dominantTendency(t: Tendencies): TendencyKey {
  let best: TendencyKey = "maker";
  for (const k of TENDENCY_KEYS) if (t[k] > t[best]) best = k;
  return best;
}

export function canEvolve(species: SpeciesDef, form: string, exp: number): boolean {
  const f = species.forms[form];
  return !!f && f.expToEvolve != null && exp >= f.expToEvolve;
}

/** 다음 폼 키. 진화 불가/종착이면 null. */
export function resolveNextForm(species: SpeciesDef, pet: PetData): string | null {
  if (!canEvolve(species, pet.form, pet.exp)) return null;
  if (pet.form === "stage1") return `stage2-${dominantTendency(pet.tendencies)}`;
  const f = species.forms[pet.form];
  if (f.branch && pet.form.startsWith("stage2-")) return `stage3-${f.branch}`;
  return null;
}

/** 진화 가능하면 폼 전진 + EXP 0, 아니면 그대로. */
export function applyEvolution(species: SpeciesDef, pet: PetData): PetData {
  const next = resolveNextForm(species, pet);
  if (!next) return pet;
  return { ...pet, form: next, exp: 0, last_updated: new Date().toISOString() };
}
