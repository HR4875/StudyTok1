import type { Palette, Quiz, Scene } from "./schema";

/* 생성 결과를 화면에 넣기 전에 다듬는 작은 규칙들 (서버에서도 그대로 쓸 수 있음) */

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 퀴즈 보기 순서를 개념마다 고정된 규칙으로 섞는다. AI가 정답을 앞쪽에 두는 버릇을 지운다 */
export function shuffleQuiz(q: Quiz, seed: string): Quiz {
  const n = q.options.length;
  if (n < 2 || q.answer < 0 || q.answer >= n) return q;
  const order = seededShuffle(
    Array.from({ length: n }, (_, i) => i),
    hash(seed),
  );
  return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
}

/** 이웃 카드끼리 배경색이 같으면 넘길 때 새 카드처럼 안 보인다 → 비슷한 결의 옆 색으로 */
const NEXT: Record<Palette, Palette> = {
  blue: "teal",
  teal: "green",
  green: "teal",
  violet: "blue",
  orange: "pink",
  pink: "orange",
  navy: "blue",
  red: "orange",
};
export function spreadPalettes(ps: Palette[]): Palette[] {
  const out: Palette[] = [];
  for (const p of ps) {
    const prev = out[out.length - 1];
    let q = p;
    if (q === prev) q = NEXT[q];
    if (q === prev) q = "blue";
    out.push(q);
  }
  return out;
}

export function normalizeScene(s: Scene, term?: string): Scene {
  const base: Scene = { ...s, term: s.term || term || "", actors: s.actors ?? [], beats: s.beats ?? [], captions: s.captions ?? [] };
  return { ...base, quiz: shuffleQuiz(base.quiz, base.term) };
}
