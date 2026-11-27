// 카드 한 장에서 화면이 쓰는 값 꺼내기. 새 카드는 텍스트 숏츠(short), 기본 카드·예전 예시는 장면(scene)을 갖는다.
import type { Card, Deck, ExamProblem, Palette, Quiz, Scene } from "./schema";
import type { TextShort } from "./visual";

type Content = { short?: TextShort | null; scene?: Scene | null; quiz?: Quiz | null };

export const quizOf = (c: Content): Quiz | undefined => c.quiz ?? c.short?.quiz ?? c.scene?.quiz;
export const paletteOf = (c: Content): Palette | undefined => c.short?.palette ?? c.scene?.palette;
/** 피드에 띄울 수 있는 카드인지 */
export const isShowable = (c: Card) => c.status === "ready" && !!(c.short || c.scene || c.spec);
/** 개념 이름: 여러 편으로 나뉜 개념은 시리즈 이름으로 묶는다 */
export const conceptNameOf = (c: Card) => c.spec?.series?.name ?? c.concept.term;

/** 카드 내용(short 또는 scene)의 배경색만 바꾼다 */
export function withPalette<T extends Content>(c: T, p: Palette): T {
  if (c.short) return { ...c, short: { ...c.short, palette: p } };
  if (c.scene) return { ...c, scene: { ...c.scene, palette: p } };
  return c;
}

/** 보관함 썸네일: 첫 카드의 배경색과 그림 속 첫 이모지 */
export function thumbOf(cards: Card[]): { palette: Palette; emoji: string } {
  const first = cards.find((c) => c.short || c.scene);
  const emojiIn = (node: unknown): string => {
    if (!node || typeof node !== "object") return "";
    if (Array.isArray(node)) {
      for (const n of node) {
        const e = emojiIn(n);
        if (e) return e;
      }
      return "";
    }
    const o = node as Record<string, unknown>;
    if (typeof o.emoji === "string" && o.emoji) return o.emoji;
    for (const v of Object.values(o)) {
      const e = emojiIn(v);
      if (e) return e;
    }
    return "";
  };
  const emoji = first?.short ? emojiIn(first.short.visual) : (first?.scene?.actors.find((a) => a.emoji)?.emoji ?? "");
  return { palette: (first && paletteOf(first)) ?? "blue", emoji: emoji || "🎞️" };
}

/** 여러 편으로 나뉜 카드를 편마다 한 장으로 펼친다 (퀴즈와 원래 id는 마지막 편에 남긴다. 오답노트가 그 id로 찾는다) */
export function expandParts(cards: Card[]): Card[] {
  return cards.flatMap((c) => {
    const parts = c.parts;
    if (c.status !== "ready" || !parts || parts.length < 2) return [c];
    return parts.map((spec, k) => ({ ...c, id: k === parts.length - 1 ? c.id : `${c.id}~${k}`, spec, parts: undefined, quiz: k === parts.length - 1 ? c.quiz : null }));
  });
}

/** 시험문제 탭에 보일 문제 전부: 덱에 직접 실린 것 + 카드마다 딸린 것 */
export function problemsOf(deck: Deck): ExamProblem[] {
  return [...(deck.problems ?? []), ...deck.cards.flatMap((c) => (c.status === "ready" ? (c.problems ?? []) : []))];
}
