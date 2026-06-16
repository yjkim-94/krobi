/**
 * 진화 폼의 임시 외형(실제 스프라이트가 나오기 전까지).
 * stage1 스프라이트를 분기별 색조 + 단계별 확대로 재사용한다.
 */
export type FormAppearance = { filter: string; scale: number };

const BRANCH_FILTER: Record<string, string> = {
  maker: "hue-rotate(-20deg) saturate(1.3)", // 더 붉은 용암
  sage: "hue-rotate(180deg) saturate(1.2) brightness(1.1)", // 푸른 등불
  wild: "hue-rotate(280deg) saturate(1.4)", // 보라/마젠타 화염
};

function branchOf(form: string): string | null {
  const m = form.match(/^stage[23]-(.+)$/);
  return m ? m[1] : null;
}

export function formAppearance(form: string): FormAppearance {
  const branch = branchOf(form);
  if (!branch) return { filter: "none", scale: 1 };
  const scale = form.startsWith("stage3-") ? 1.4 : 1.2;
  return { filter: BRANCH_FILTER[branch] ?? "none", scale };
}
