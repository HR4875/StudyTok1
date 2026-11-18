// 글자 다듬기 도우미 (서버·브라우저 같이 씀)

/** 문자열이면 공백을 하나로 줄이고 max 글자까지, 아니면 "" */
export const cleanStr = (v: unknown, max = 400): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** 화면 폭 기준 길이 (한글·한자 1, 영문·숫자 0.6, 공백 0.35) */
export function visualLength(s: string): number {
  let n = 0;
  for (const ch of Array.from(s)) n += /[ᄀ-ᇿ가-힣　-鿿]/.test(ch) ? 1 : ch === " " ? 0.35 : 0.6;
  return n;
}

/** 화면 폭 기준으로 너무 길면 자르고 … 를 붙인다 */
export function clip(s: string, maxVisual: number): string {
  if (visualLength(s) <= maxVisual) return s;
  let out = "";
  for (const ch of Array.from(s)) {
    if (visualLength(out + ch) > maxVisual - 0.5) break;
    out += ch;
  }
  return out.trimEnd() + "…";
}
