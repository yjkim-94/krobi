import type { SpeciesDef } from "./types";

// 빌드 시 모든 종 폴더의 species.json 을 수집("krombi" / "mochi" / ...).
const modules = import.meta.glob("../assets/pets/*/species.json", {
  eager: true,
}) as Record<string, { default: SpeciesDef }>;

function speciesIdFromPath(path: string): string {
  // ".../assets/pets/<id>/species.json" -> "<id>"
  const m = path.match(/\/assets\/pets\/([^/]+)\/species\.json$/);
  return m ? m[1] : "";
}

const REGISTRY: Record<string, SpeciesDef> = {};
for (const [path, mod] of Object.entries(modules)) {
  const id = speciesIdFromPath(path);
  if (id) REGISTRY[id] = mod.default;
}

export function getSpeciesDef(id: string): SpeciesDef | undefined {
  return REGISTRY[id];
}

export function allSpeciesIds(): string[] {
  return Object.keys(REGISTRY);
}
