import type { PetManifest } from "./types";

export type FormAsset = { manifest: PetManifest; sheetUrl: string };

// 빌드 시 모든 종의 모든 폼 폴더에서 manifest/sheet 를 수집 ("krombi/stage1", "mochi/stage2-sage", ...).
const manifests = import.meta.glob("../assets/pets/*/*/manifest.json", {
  eager: true,
}) as Record<string, { default: PetManifest }>;
const sheets = import.meta.glob("../assets/pets/*/*/sheet.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function parsePath(path: string): { speciesId: string; form: string } | null {
  // ".../assets/pets/<speciesId>/<form>/manifest.json" -> { speciesId, form }
  const m = path.match(/\/assets\/pets\/([^/]+)\/([^/]+)\/manifest\.json$/);
  return m ? { speciesId: m[1], form: m[2] } : null;
}

const REGISTRY: Record<string, FormAsset> = {};
for (const [path, mod] of Object.entries(manifests)) {
  const parsed = parsePath(path);
  if (!parsed) continue;
  const url = sheets[path.replace("manifest.json", "sheet.png")];
  if (url) REGISTRY[`${parsed.speciesId}/${parsed.form}`] = { manifest: mod.default, sheetUrl: url };
}

/** 실제 에셋이 있으면 반환, 없으면 null. */
export function speciesFormAsset(speciesId: string, form: string): FormAsset | null {
  return REGISTRY[`${speciesId}/${form}`] ?? null;
}
