// 카드 한 장에서 화면이 쓰는 값 꺼내기. 새 카드는 텍스트 숏츠(short), 기본 카드·예전 예시는 장면(scene)을 갖는다.
import type { Card, Palette, Quiz, Scene } from "./schema";
import type { TextShort } from "./visual";

type Content = { short?: TextShort | null; scene?: Scene | null };

export const quizOf = (c: Content): Quiz | undefined => c.short?.quiz ?? c.scene?.quiz;
export const paletteOf = (c: Content): Palette | undefined => c.short?.palette ?? c.scene?.palette;
/** 피드에 띄울 수 있는 카드인지 */
export const isShowable = (c: Card) => c.status === "ready" && !!(c.short || c.scene);

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
