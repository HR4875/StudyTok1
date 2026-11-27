// 시리즈마다 입을 디자인(템플릿)을 고른다. 자료와 계획의 낱말로 고르고, 왜 골랐는지 한 줄로 남긴다 (AI 호출 없음, 비용 0).
import { SKINS } from "./skins";

export interface DesignPick {
  skin: string;
  /** 왜 이 디자인인지 한 줄 */
  why: string;
  /** auto: 자동 추천 그대로, picked: 만들 때 직접 고름 */
  how: "auto" | "picked";
  /** 자동 추천이 본 낱말 (보여 주기용) */
  hits: string[];
}

/** 디자인마다 어울리는 내용과 그 까닭. 앞에 있을수록 동점일 때 먼저 고른다 */
const RULES: { skin: string; words: string[]; why: string }[] = [
  {
    skin: "paper",
    words: ["가격", "가치", "주가", "옵션", "이자", "할인", "현금흐름", "재무", "회계", "감가상각", "원가", "수익", "비용", "자산", "부채", "그래프", "추이", "모형", "위험", "채권", "환율", "만기", "시간"],
    why: "숫자가 시간에 따라 바뀌는 내용이라, 그래프와 왼쪽에서 오른쪽으로 자라는 나무가 가장 또렷한 디자인 F(페이퍼)를 골랐어요.",
  },
  {
    skin: "blueprint",
    words: ["절차", "과정", "단계", "흐름", "서류", "신용장", "무역", "선적", "통관", "구조", "설계", "회로", "시스템", "공정", "프로세스", "계약"],
    why: "여러 주체와 서류가 순서대로 오가는 내용이라, 선과 화살표가 잘 보이는 블루프린트를 골랐어요.",
  },
  {
    skin: "ink",
    words: ["공식", "정리", "증명", "확률", "통계", "분포", "기댓값", "방정식", "함수", "미분", "적분", "행렬", "정의"],
    why: "식과 기호가 중심인 내용이라, 색을 하나만 써서 핵심만 남기는 디자인 B(잉크)를 골랐어요.",
  },
  {
    skin: "note",
    words: ["법", "조항", "판례", "암기", "용어", "개념", "분류", "종류", "특징", "비교", "차이", "요건"],
    why: "용어를 나누고 비교하는 내용이라, 필기 노트처럼 정리해 보이는 노트를 골랐어요.",
  },
  {
    skin: "pop",
    words: ["마케팅", "소비자", "브랜드", "광고", "트렌드", "고객", "시장", "전략", "조직", "리더십", "동기"],
    why: "사례와 사람 이야기가 많은 내용이라, 밝고 경쾌한 팝을 골랐어요.",
  },
  {
    skin: "night",
    words: ["코드", "프로그래밍", "알고리즘", "데이터", "네트워크", "보안", "컴퓨터", "우주", "물리"],
    why: "기술 내용이라, 어두운 바탕에 대상이 빛나는 나이트를 골랐어요.",
  },
];

const FALLBACK = "딱 맞는 낱말이 없어서, 기본이자 모션이 가장 많은 디자인 F(페이퍼)를 골랐어요.";

/** 자료, 주제, 계획 글에서 디자인을 고른다 */
export function recommendDesign(text: string): DesignPick {
  const t = text.slice(0, 20000);
  let best: { skin: string; why: string; hits: string[]; score: number } | null = null;
  for (const r of RULES) {
    const hits: string[] = [];
    let score = 0;
    for (const w of r.words) {
      const n = t.split(w).length - 1;
      if (n) {
        hits.push(w);
        score += Math.min(n, 4);
      }
    }
    if (score && (!best || score > best.score)) best = { skin: r.skin, why: r.why, hits, score };
  }
  if (!best) return { skin: "paper", why: FALLBACK, how: "auto", hits: [] };
  return { skin: best.skin, why: best.why, how: "auto", hits: best.hits.slice(0, 6) };
}

/** 사람이 직접 고른 디자인 */
export function pickedDesign(skin: string, auto: DesignPick): DesignPick {
  const name = SKINS[skin]?.name ?? skin;
  if (skin === auto.skin) return { ...auto, how: "picked" };
  return { skin, why: `만들 때 ${name}을(를) 직접 골랐어요. 자동 추천은 ${SKINS[auto.skin]?.name ?? auto.skin}이었어요.`, how: "picked", hits: auto.hits };
}

/** 내장 시리즈가 입는 디자인과 그 까닭 */
export const BUILT_DESIGN: Record<string, DesignPick> = {
  bino: { skin: "paper", why: "주가가 시간에 따라 갈라지는 나무와 값 그래프가 핵심이라 디자인 F(페이퍼)를 골랐어요.", how: "auto", hits: ["주가", "옵션", "만기", "가치"] },
  lc: { skin: "paper", why: "서류가 순서대로 오가는 내용이지만, 팀 기본 디자인을 맞추려고 디자인 F(페이퍼)로 두었어요.", how: "auto", hits: ["신용장", "서류", "선적"] },
  dep: { skin: "paper", why: "장부 금액이 해마다 줄어드는 그래프가 핵심이라 디자인 F(페이퍼)를 골랐어요.", how: "auto", hits: ["감가상각", "원가", "자산"] },
  ex: { skin: "paper", why: "맛보기 묶음은 기본 디자인 F(페이퍼)로 보여 줘요.", how: "auto", hits: [] },
};
