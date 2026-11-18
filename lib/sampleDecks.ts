// 키 없이 바로 보는 예시 덱.
// 1) 마케팅: 디자인 스레드가 시험용 강의 자료로 실제 생성한 텍스트 숏츠 5장 (모션 보기도 같은 카드로)
// 2) 맛보기 4과목: 처음 시안의 자유 모션 예시
import { buildShort, checkOutline, spreadShortPalettes } from "./assemble";
import { SAMPLE_DECK } from "./samples";
import { MKT_FILLS, MKT_OUTLINE } from "./samples-marketing";
import type { Card, Deck } from "./schema";

function marketingDeck(): Deck {
  const { deckTitle, subject, concepts } = checkOutline(MKT_OUTLINE, 5);
  const cards: Card[] = concepts.map((c, i) => {
    const { short } = buildShort(c, MKT_FILLS[i]);
    return {
      id: `sample-mkt-${i}`,
      concept: c,
      short: short ?? null,
      scene: null,
      status: short ? ("ready" as const) : ("error" as const),
      error: short ? undefined : "예시 카드를 만들지 못했어요",
    };
  });
  return {
    id: "sample-marketing",
    title: deckTitle || "마케팅 전략의 기초",
    subject: subject || "경영학",
    source: "시험용 예시 강의 자료",
    createdAt: Date.UTC(2026, 10, 9),
    sample: true,
    cards: spreadShortPalettes(cards),
  };
}

export const MARKETING_DECK = marketingDeck();
/** 홈의 "예시부터 볼래요"는 첫 덱을 연다 */
export const SAMPLE_DECKS: Deck[] = [MARKETING_DECK, SAMPLE_DECK];
