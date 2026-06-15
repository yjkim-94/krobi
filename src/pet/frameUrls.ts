// Vite가 빌드 시 각 PNG를 URL로 변환해 eager 로드한다.
const modules = import.meta.glob("../assets/pets/krobi/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** base 파일명(확장자 제외) -> 에셋 URL */
export const krobiFrameUrls: Record<string, string> = Object.fromEntries(
  Object.entries(modules).map(([path, url]) => {
    const name = path.split("/").pop()!.replace(/\.png$/, "");
    return [name, url];
  }),
);
