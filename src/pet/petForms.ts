import type { PetManifest } from "./types";

// 빌드 시 krombi 모든 폼 폴더의 manifest/sheet 를 수집(있는 폼만).
const manifests = import.meta.glob("../assets/pets/krombi/*/manifest.json", {
  eager: true,
}) as Record<string, { default: PetManifest }>;
const sheets = import.meta.glob("../assets/pets/krombi/*/sheet.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export type FormAsset = { manifest: PetManifest; sheetUrl: string };

function formKey(path: string): string {
  // ".../krombi/<form>/manifest.json" -> "<form>"
  const m = path.match(/\/krombi\/([^/]+)\//);
  return m ? m[1] : "";
}

const REGISTRY: Record<string, FormAsset> = {};
for (const [path, mod] of Object.entries(manifests)) {
  const form = formKey(path);
  const url = sheets[path.replace("manifest.json", "sheet.png")];
  if (form && url) REGISTRY[form] = { manifest: mod.default, sheetUrl: url };
}

/** 실제 에셋이 있는 폼이면 반환, 없으면 null(placeholder 색조로 대체). */
export function formAsset(form: string): FormAsset | null {
  return REGISTRY[form] ?? null;
}
