// 모션 쇼츠 화면에서 같이 쓰는 표기
/** 재생 시각: 75 → "1:15" */
export const fmtT = (t: number): string => {
  const s = Math.max(0, Math.round(t));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};
/** 길이: 46.9 → "47초" */
export const secs = (t: number): string => Math.round(t) + "초";
/** 비용: 0.0168 → "0.017달러" */
export const usd = (v: number): string => v.toFixed(3) + "달러";
