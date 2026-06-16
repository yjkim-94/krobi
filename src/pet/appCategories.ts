import type { TendencyKey } from "./petState";

/** 번들ID(소문자) → 성향. 우선 매칭. */
const BY_BUNDLE: Record<string, TendencyKey> = {
  // maker — 생산·창작
  "com.microsoft.vscode": "maker",
  "com.apple.dt.xcode": "maker",
  "com.googlecode.iterm2": "maker",
  "com.apple.terminal": "maker",
  "com.jetbrains.intellij": "maker",
  "com.jetbrains.pycharm": "maker",
  "com.sublimetext.4": "maker",
  "com.figma.desktop": "maker",
  "com.microsoft.word": "maker",
  "com.microsoft.excel": "maker",
  "com.microsoft.powerpoint": "maker",
  "com.apple.iwork.pages": "maker",
  "com.apple.iwork.numbers": "maker",
  "notion.id": "maker",
  "com.hancom.hwp": "maker",
  // sage — 탐구·학습
  "com.google.chrome": "sage",
  "com.apple.safari": "sage",
  "org.mozilla.firefox": "sage",
  "company.thebrowser.browser": "sage", // Arc
  "com.microsoft.edgemac": "sage",
  "com.apple.preview": "sage",
  "com.readdle.pdfexpert-mac": "sage",
  "com.literatureandlatte.scrivener3": "sage",
  "md.obsidian": "sage",
  // wild — 유희·감상
  "com.valvesoftware.steam": "wild",
  "com.spotify.client": "wild",
  "com.apple.music": "wild",
  "com.apple.tv": "wild",
  "tv.plex.player": "wild",
  "com.colliderli.iina": "wild",
  "com.hnc.discord": "wild",
  "com.tinyspeck.slackmacgap": "wild",
  "com.kakao.kakaotalkmac": "wild",
};

/** 번들ID 미스 시 이름(소문자) 부분일치. 위→아래 순. */
const BY_NAME: { match: string; key: TendencyKey }[] = [
  { match: "code", key: "maker" },
  { match: "terminal", key: "maker" },
  { match: "xcode", key: "maker" },
  { match: "word", key: "maker" },
  { match: "excel", key: "maker" },
  { match: "figma", key: "maker" },
  { match: "chrome", key: "sage" },
  { match: "safari", key: "sage" },
  { match: "firefox", key: "sage" },
  { match: "preview", key: "sage" },
  { match: "steam", key: "wild" },
  { match: "spotify", key: "wild" },
  { match: "discord", key: "wild" },
  { match: "youtube", key: "wild" },
];

/** 활성 앱을 성향으로 분류. 모르는 앱이면 null. */
export function classifyApp(name: string, bundleId?: string): TendencyKey | null {
  if (bundleId) {
    const hit = BY_BUNDLE[bundleId.toLowerCase()];
    if (hit) return hit;
  }
  const lower = name.toLowerCase();
  for (const { match, key } of BY_NAME) if (lower.includes(match)) return key;
  return null;
}
