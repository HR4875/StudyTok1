/* 경영학원론 6주차 PDF로 실제 생성한 결과 (Opus 5.5 · 노력 중간, 2026-11-09)
   1단계 개념+그림 판단 1회, 2단계 텍스트 숏츠 칸 채우기 5회, 비교용 자유 모션 5회. */
import type { Scene } from "./schema";

export const MKT_OUTLINE = {
 "deckTitle": "마케팅 전략의 기초",
 "subject": "경영학원론",
 "concepts": [
  {
   "term": "STP 전략",
   "definition": "시장을 나누고, 고르고, 자리 잡는 전략",
   "explanation": "마케팅 전략은 '모든 사람에게 팔겠다'는 생각을 버리는 데서 시작한다. 비슷한 필요를 가진 고객끼리 시장을 나누고(세분화), 시장 매력도와 회사 역량을 따져 집중할 집단을 고른 뒤(표적시장 선정), 그 고객의 머릿속에 경쟁 제품과 구별되는 자리를 차지한다(포지셔닝).",
   "keyPoints": [
    "세분화는 나누기, 표적 선정은 고르기",
    "표적 선정 기준: 시장 매력도와 역량",
    "세분화 기준: 인구통계·지리·심리·행동"
   ],
   "example": "탄산음료 시장을 나눈 뒤 '칼로리를 신경 쓰는 20~30대'를 골라 '칼로리 걱정 없는 진짜 콜라 맛'으로 포지셔닝한 제로 콜라.",
   "visual": "하나의 큰 시장 덩어리가 여러 고객 집단으로 쪼개지고, 그중 한 집단에 깃발이 꽂힌 뒤 그 고객 머릿속에 제품 자리가 생기는 장면.",
   "pages": "p.2",
   "plan": {
    "kind": "process",
    "template": "flow",
    "why": "나누기→고르기→자리 잡기의 정해진 세 단계",
    "focus": "나누는 것과 고르는 것은 다른 단계",
    "motion": "시장이 쪼개지고 한 조각이 선택돼 앞으로 나옴",
    "cast": [
     "전체 시장",
     "세분화",
     "표적 선정",
     "포지셔닝"
    ]
   }
  },
  {
   "term": "포지셔닝 맵(지각도)",
   "definition": "두 기준 축 위에 경쟁 브랜드를 찍은 그림",
   "explanation": "소비자가 중요하게 여기는 두 가지 기준을 가로축과 세로축으로 놓고, 경쟁 브랜드가 소비자 머릿속에서 어디에 있는지 점으로 찍는다. 경쟁자가 몰린 곳을 피하고 비어 있는 자리를 새로운 기회로 찾는 데 쓴다.",
   "keyPoints": [
    "축은 소비자가 중시하는 기준으로",
    "회사가 정하고 싶은 기준이면 안 됨",
    "비어 있는 자리가 새로운 기회"
   ],
   "example": "가격(저가↔고가)과 이용 방식(테이크아웃↔머무는 공간) 축에 스타벅스, 메가커피, 블루보틀, 편의점 커피를 찍고, '저가이면서 오래 머물기 좋은 공간'을 빈자리로 찾는다.",
   "visual": "가격과 이용 방식 두 축 위에 커피 브랜드 점들이 흩어져 있고, 한 사분면만 비어 반짝이는 장면.",
   "pages": "p.3",
   "plan": {
    "kind": "two-axis",
    "template": "matrix",
    "why": "두 기준 축으로 브랜드 위치를 정하는 도구",
    "focus": "아무도 없는 빈 사분면이 기회",
    "motion": "브랜드 점이 하나씩 찍히고 빈 칸이 깜빡임",
    "cast": [
     "스타벅스",
     "메가커피",
     "블루보틀",
     "편의점 커피",
     "빈 자리"
    ]
   }
  },
  {
   "term": "4P 마케팅 믹스",
   "definition": "포지셔닝을 실행하는 제품·가격·유통·촉진",
   "explanation": "마케팅 믹스는 포지셔닝을 실제 행동으로 옮기는 도구이며, 매카시는 이를 제품·가격·유통·촉진의 4P로 정리했다. 네 요소는 따로 놀면 안 되고 같은 포지셔닝을 향해 서로 맞물려야 한다.",
   "keyPoints": [
    "네 요소는 같은 포지셔닝으로 일관",
    "Place는 유통, Promotion은 촉진",
    "고객 관점으로 바꾸면 4C"
   ],
   "example": "프리미엄 포지셔닝인데 대형마트에서 1+1 행사를 하면 4P가 서로 충돌한다.",
   "visual": "'4P' 상자 아래로 제품·가격·유통·촉진 네 가지가 갈라지고, 각 가지에 '무엇을·얼마에·어디서·어떻게' 꼬리표가 붙은 장면.",
   "pages": "p.4",
   "plan": {
    "kind": "classification",
    "template": "tree",
    "why": "하나의 믹스가 네 구성 요소로 나뉨",
    "focus": "네 요소와 각각이 답하는 질문",
    "motion": "4P에서 네 가지가 차례로 뻗어 나옴",
    "cast": [
     "4P",
     "제품",
     "가격",
     "유통",
     "촉진"
    ]
   }
  },
  {
   "term": "제품수명주기(PLC)",
   "definition": "시간에 따른 매출·이익 변화의 네 단계",
   "explanation": "제품도 사람처럼 도입기, 성장기, 성숙기, 쇠퇴기를 거친다. 매출 곡선은 S자로 오르다 성숙기에 꼭대기를 찍고 내려오며, 이익 곡선은 도입기에 0 아래에서 시작해 매출보다 먼저 꼭대기를 찍는다.",
   "keyPoints": [
    "도입기 이익은 보통 적자",
    "이익은 매출보다 먼저 정점",
    "경쟁이 가장 치열한 때는 성숙기"
   ],
   "example": "피처폰은 쇠퇴기, 스마트폰은 성숙기, 폴더블폰은 성장기로 볼 수 있다.",
   "visual": "가로축 시간, 세로축 금액 그래프에서 매출 곡선이 S자로 올라 정점 뒤 내려오고, 이익 곡선이 0 아래에서 출발해 더 일찍 정점을 찍는 장면.",
   "pages": "p.5",
   "plan": {
    "kind": "quantity",
    "template": "chart",
    "why": "매출과 이익이 시간에 따라 함께 움직이는 추세",
    "focus": "이익 정점이 매출 정점보다 앞섬",
    "motion": "두 곡선이 시간축 따라 그려지며 정점 표시",
    "cast": [
     "매출",
     "이익",
     "도입기",
     "성숙기",
     "쇠퇴기"
    ]
   }
  },
  {
   "term": "신제품 가격 전략",
   "definition": "높게 시작할지 낮게 시작할지 정하는 가격법",
   "explanation": "초기 고가 전략(스키밍)은 높은 가격으로 얼리어답터에게 팔고 시간이 지나며 가격을 낮춘다. 시장 침투 가격 전략은 처음부터 낮은 가격으로 많은 고객을 확보해 시장 점유율을 먼저 차지한다.",
   "keyPoints": [
    "스키밍: 높게 시작해 내려가기",
    "침투: 낮게 시작해 넓게 깔기",
    "침투 조건: 가격 민감·규모의 경제"
   ],
   "example": "스키밍은 신형 게임 콘솔·최신 스마트폰, 침투는 구독 서비스의 첫 달 무료·저가 요금제.",
   "visual": "왼쪽에는 높은 가격표가 계단처럼 내려가고, 오른쪽에는 낮은 가격표가 넓게 퍼져 많은 고객을 덮는 장면.",
   "pages": "p.6",
   "plan": {
    "kind": "comparison",
    "template": "versus",
    "why": "두 가격 전략의 출발점과 조건 대조가 핵심",
    "focus": "높게 시작 vs 낮게 시작",
    "motion": "왼쪽 가격은 내려가고 오른쪽은 옆으로 퍼짐",
    "cast": [
     "스키밍",
     "침투",
     "얼리어답터",
     "점유율"
    ]
   }
  }
 ]
} as const;

/** 2단계 결과(CardFill) 원본 */
export const MKT_FILLS: unknown[] = [
 {
  "hook": "제로 콜라는 왜 모두에게 안 팔까?",
  "highlight": "나누고, 고르고",
  "palette": "violet",
  "visual": {
   "type": "flow",
   "steps": [
    {
     "emoji": "🌐",
     "label": "전체 시장",
     "sub": "모든 고객 한 덩어리"
    },
    {
     "emoji": "✂️",
     "label": "세분화",
     "sub": "비슷한 고객끼리 묶기"
    },
    {
     "emoji": "🎯",
     "label": "표적 선정",
     "sub": "매력도·역량 따지기"
    },
    {
     "emoji": "🧠",
     "label": "포지셔닝",
     "sub": "고객 머릿속 차지"
    }
   ],
   "focus": 2
  },
  "quiz": {
   "question": "시장 매력도와 회사 역량을 따지는 단계는?",
   "options": [
    "세분화",
    "표적 선정",
    "포지셔닝",
    "전체 시장 파악"
   ],
   "answer": 1,
   "explanation": "나눈 집단 중 매력도와 역량을 따져 집중할 곳을 고르는 단계가 표적 선정이다."
  }
 },
 {
  "hook": "카페 창업, 어디에 차려야 할까?",
  "highlight": "두 기준 축",
  "palette": "violet",
  "visual": {
   "type": "matrix",
   "x": {
    "name": "가격",
    "low": "저가",
    "high": "고가"
   },
   "y": {
    "name": "이용 방식",
    "low": "테이크아웃",
    "high": "머무는 곳"
   },
   "items": [
    {
     "emoji": "☕",
     "label": "스타벅스",
     "x": 75,
     "y": 80
    },
    {
     "emoji": "💙",
     "label": "블루보틀",
     "x": 90,
     "y": 65
    },
    {
     "emoji": "🥤",
     "label": "메가커피",
     "x": 20,
     "y": 20
    },
    {
     "emoji": "🏪",
     "label": "편의점커피",
     "x": 8,
     "y": 8
    }
   ],
   "focus": -1,
   "gap": {
    "emoji": "✨",
    "label": "저가 휴식 공간",
    "x": 20,
    "y": 80
   }
  },
  "quiz": {
   "question": "이 지각도에서 새로운 기회로 볼 자리는?",
   "options": [
    "고가이면서 머무는 공간",
    "저가이면서 머무는 공간",
    "저가이면서 테이크아웃",
    "고가이면서 테이크아웃"
   ],
   "answer": 1,
   "explanation": "경쟁 브랜드가 없는 빈 사분면이 새로운 기회다."
  }
 },
 {
  "hook": "프리미엄 브랜드는 왜 1+1을 안 할까?",
  "highlight": "포지셔닝을 실행하는",
  "palette": "violet",
  "visual": {
   "type": "tree",
   "root": {
    "emoji": "🎯",
    "label": "4P",
    "sub": ""
   },
   "children": [
    {
     "emoji": "📦",
     "label": "제품",
     "sub": "무엇을 팔까"
    },
    {
     "emoji": "🏷️",
     "label": "가격",
     "sub": "얼마에 팔까"
    },
    {
     "emoji": "🚚",
     "label": "유통",
     "sub": "어디서 팔까"
    },
    {
     "emoji": "📣",
     "label": "촉진",
     "sub": "어떻게 알릴까"
    }
   ]
  },
  "quiz": {
   "question": "그림에서 '어디서 팔까'에 답하는 P는?",
   "options": [
    "유통(Place)",
    "촉진(Promotion)",
    "제품(Product)",
    "가격(Price)"
   ],
   "answer": 0,
   "explanation": "Place는 유통으로 어디서 팔지 정하고, Promotion은 촉진이다."
  }
 },
 {
  "hook": "잘 팔리는데 왜 이익은 줄어들까?",
  "highlight": "매출·이익 변화",
  "palette": "orange",
  "visual": {
   "type": "chart",
   "kind": "line",
   "xLabel": "시간",
   "yLabel": "금액",
   "categories": [
    "도입기",
    "성장기",
    "성숙기",
    "쇠퇴기"
   ],
   "series": [
    {
     "name": "매출",
     "values": [
      15,
      60,
      90,
      40
     ]
    },
    {
     "name": "이익",
     "values": [
      -15,
      45,
      35,
      5
     ]
    }
   ],
   "focus": 1,
   "note": "이익이 먼저 정점",
   "illustrative": true
  },
  "quiz": {
   "question": "그래프에서 매출 곡선이 꼭대기를 찍는 단계는?",
   "options": [
    "도입기",
    "성장기",
    "성숙기",
    "쇠퇴기"
   ],
   "answer": 2,
   "explanation": "매출은 성숙기에 정점을 찍고, 이익은 그보다 먼저 정점에 닿는다."
  }
 },
 {
  "hook": "새 폰은 왜 출시 때 제일 비쌀까?",
  "highlight": "높게 시작할지",
  "palette": "orange",
  "visual": {
   "type": "versus",
   "a": {
    "emoji": "📉",
    "label": "스키밍",
    "sub": "얼리어답터부터 공략"
   },
   "b": {
    "emoji": "🌊",
    "label": "시장 침투",
    "sub": "점유율 먼저 확보"
   },
   "rows": [
    {
     "name": "출발 가격",
     "a": "높게",
     "b": "낮게"
    },
    {
     "name": "첫 고객",
     "a": "얼리어답터",
     "b": "많은 고객"
    },
    {
     "name": "예시",
     "a": "신형 게임 콘솔",
     "b": "첫 달 무료"
    }
   ]
  },
  "quiz": {
   "question": "얼리어답터에게 비싸게 판 뒤 점차 가격을 낮추는 전략은?",
   "options": [
    "초기 고가 전략(스키밍)",
    "시장 침투 가격 전략",
    "규모의 경제",
    "시장 점유율 전략"
   ],
   "answer": 0,
   "explanation": "높은 가격으로 얼리어답터에게 팔고 시간이 지나며 가격을 낮추는 것이 스키밍이다."
  }
 }
];

/** 비교용: AI가 좌표·타이밍까지 직접 쓴 자유 모션 장면 원본 */
export const MKT_FREE = [
 {
  "hook": "왜 모두에게 팔면 안 될까?",
  "term": "STP 전략",
  "definition": "시장을 나누고, 고르고, 자리 잡는 전략",
  "highlight": "나누고, 고르고",
  "palette": "violet",
  "actors": [
   {
    "id": "market",
    "type": "circle",
    "emoji": "👥",
    "label": "전체 시장",
    "x": 50,
    "y": 30,
    "w": 0,
    "h": 0,
    "size": "l",
    "color": "blue",
    "value": 0,
    "hidden": false
   },
   {
    "id": "segA",
    "type": "circle",
    "emoji": "🧑",
    "label": "집단 A",
    "x": 20,
    "y": 30,
    "w": 0,
    "h": 0,
    "size": "m",
    "color": "white",
    "value": 0,
    "hidden": true
   },
   {
    "id": "segC",
    "type": "circle",
    "emoji": "🧓",
    "label": "집단 C",
    "x": 80,
    "y": 30,
    "w": 0,
    "h": 0,
    "size": "m",
    "color": "white",
    "value": 0,
    "hidden": true
   },
   {
    "id": "mind",
    "type": "card",
    "emoji": "🧠",
    "label": "고객 머릿속",
    "x": 80,
    "y": 78,
    "w": 0,
    "h": 0,
    "size": "m",
    "color": "purple",
    "value": 0,
    "hidden": true
   }
  ],
  "beats": [
   {
    "t": 0.4,
    "do": "enter",
    "a": "segA",
    "b": "market",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "left",
    "d": 0,
    "id": ""
   },
   {
    "t": 0.8,
    "do": "enter",
    "a": "segC",
    "b": "market",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "right",
    "d": 0,
    "id": ""
   },
   {
    "t": 1.2,
    "do": "swap",
    "a": "market",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "집단 B",
    "emoji": "🙋",
    "value": 0,
    "style": "",
    "d": 0,
    "id": ""
   },
   {
    "t": 2.3,
    "do": "dim",
    "a": "segA",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "on",
    "d": 0,
    "id": ""
   },
   {
    "t": 2.7,
    "do": "dim",
    "a": "segC",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "on",
    "d": 0,
    "id": ""
   },
   {
    "t": 3.1,
    "do": "move",
    "a": "market",
    "b": "",
    "x": 50,
    "y": 58,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "",
    "d": 0.8,
    "id": ""
   },
   {
    "t": 4.2,
    "do": "enter",
    "a": "mind",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "pop",
    "d": 0,
    "id": ""
   },
   {
    "t": 5.0,
    "do": "swap",
    "a": "mind",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "제로 콜라 자리",
    "emoji": "🥤",
    "value": 0,
    "style": "",
    "d": 0,
    "id": ""
   }
  ],
  "captions": [
   {
    "t": 0.3,
    "text": "먼저 비슷한 고객끼리 나눠요"
   },
   {
    "t": 2.3,
    "text": "나누기와 고르기는 다른 단계"
   },
   {
    "t": 3.1,
    "text": "매력도·역량 따져 한 곳 선택"
   },
   {
    "t": 4.2,
    "text": "고객 머릿속에 자리 잡기"
   }
  ],
  "quiz": {
   "question": "STP 전략에서 시장 매력도와 회사 역량을 따져 집중할 고객 집단을 고르는 단계는?",
   "options": [
    "세분화",
    "표적시장 선정",
    "포지셔닝",
    "시장 통합"
   ],
   "answer": 1,
   "explanation": "세분화는 나누기, 표적시장 선정은 시장 매력도와 역량을 따져 고르기예요."
  }
 },
 {
  "hook": "새 카페, 어디에 자리 잡을까?",
  "term": "포지셔닝 맵(지각도)",
  "definition": "두 기준 축 위에 경쟁 브랜드를 찍은 그림",
  "highlight": "두 기준 축",
  "palette": "teal",
  "actors": [
   {
    "id": "axis",
    "type": "pill",
    "emoji": "",
    "label": "저가 ↔ 고가",
    "x": 50,
    "y": 44,
    "w": 0,
    "h": 0,
    "size": "s",
    "color": "navy",
    "value": 0,
    "hidden": true
   },
   {
    "id": "starbucks",
    "type": "circle",
    "emoji": "☕",
    "label": "스타벅스",
    "x": 78,
    "y": 22,
    "w": 0,
    "h": 0,
    "size": "s",
    "color": "green",
    "value": 0,
    "hidden": true
   },
   {
    "id": "bluebottle",
    "type": "circle",
    "emoji": "☕",
    "label": "블루보틀",
    "x": 78,
    "y": 62,
    "w": 0,
    "h": 0,
    "size": "s",
    "color": "blue",
    "value": 0,
    "hidden": true
   },
   {
    "id": "mega",
    "type": "circle",
    "emoji": "☕",
    "label": "메가커피",
    "x": 22,
    "y": 62,
    "w": 0,
    "h": 0,
    "size": "s",
    "color": "yellow",
    "value": 0,
    "hidden": true
   },
   {
    "id": "cvs",
    "type": "circle",
    "emoji": "🏪",
    "label": "편의점 커피",
    "x": 46,
    "y": 82,
    "w": 0,
    "h": 0,
    "size": "s",
    "color": "orange",
    "value": 0,
    "hidden": true
   },
   {
    "id": "empty",
    "type": "card",
    "emoji": "✨",
    "label": "빈 자리",
    "x": 22,
    "y": 22,
    "w": 0,
    "h": 0,
    "size": "m",
    "color": "yellow",
    "value": 0,
    "hidden": true
   }
  ],
  "beats": [
   {
    "t": 0.2,
    "do": "enter",
    "a": "axis",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "fade",
    "d": 0,
    "id": ""
   },
   {
    "t": 0.8,
    "do": "enter",
    "a": "starbucks",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "drop",
    "d": 0,
    "id": ""
   },
   {
    "t": 1.4,
    "do": "enter",
    "a": "bluebottle",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "drop",
    "d": 0,
    "id": ""
   },
   {
    "t": 2.0,
    "do": "enter",
    "a": "mega",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "drop",
    "d": 0,
    "id": ""
   },
   {
    "t": 2.6,
    "do": "enter",
    "a": "cvs",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "drop",
    "d": 0,
    "id": ""
   },
   {
    "t": 3.4,
    "do": "enter",
    "a": "empty",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "pop",
    "d": 0,
    "id": ""
   },
   {
    "t": 4.0,
    "do": "glow",
    "a": "empty",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "",
    "d": 1.6,
    "id": ""
   },
   {
    "t": 5.0,
    "do": "mark",
    "a": "empty",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "check",
    "d": 0,
    "id": ""
   }
  ],
  "captions": [
   {
    "t": 0.2,
    "text": "가로축은 가격, 세로축은 공간"
   },
   {
    "t": 0.8,
    "text": "브랜드를 점으로 하나씩 찍고"
   },
   {
    "t": 3.4,
    "text": "저가인데 머물 곳은 비었네"
   },
   {
    "t": 4.4,
    "text": "빈자리가 새로운 기회!"
   }
  ],
  "quiz": {
   "question": "포지셔닝 맵의 두 축을 정하는 기준으로 알맞은 것은?",
   "options": [
    "회사가 정하고 싶은 기준",
    "소비자가 중시하는 기준",
    "경쟁사가 쓰는 기준",
    "매출이 가장 큰 기준"
   ],
   "answer": 1,
   "explanation": "축은 소비자가 중요하게 여기는 기준으로 놓아야 해요. 회사가 정하고 싶은 기준이면 안 돼요."
  }
 },
 {
  "hook": "포지셔닝, 실제로는 어떻게 실행할까?",
  "term": "4P 마케팅 믹스",
  "definition": "포지셔닝을 실행하는 제품·가격·유통·촉진",
  "highlight": "제품·가격·유통·촉진",
  "palette": "orange",
  "actors": [
   {
    "id": "fourp",
    "type": "pill",
    "emoji": "",
    "label": "4P",
    "x": 50,
    "y": 14,
    "w": 0,
    "h": 0,
    "size": "l",
    "color": "navy",
    "value": 0,
    "hidden": false
   },
   {
    "id": "product",
    "type": "card",
    "emoji": "📦",
    "label": "제품",
    "x": 12,
    "y": 62,
    "w": 0,
    "h": 0,
    "size": "s",
    "color": "white",
    "value": 0,
    "hidden": true
   },
   {
    "id": "price",
    "type": "card",
    "emoji": "🏷️",
    "label": "가격",
    "x": 37,
    "y": 62,
    "w": 0,
    "h": 0,
    "size": "s",
    "color": "white",
    "value": 0,
    "hidden": true
   },
   {
    "id": "place",
    "type": "card",
    "emoji": "🚚",
    "label": "유통",
    "x": 62,
    "y": 62,
    "w": 0,
    "h": 0,
    "size": "s",
    "color": "white",
    "value": 0,
    "hidden": true
   },
   {
    "id": "promo",
    "type": "card",
    "emoji": "📣",
    "label": "촉진",
    "x": 87,
    "y": 62,
    "w": 0,
    "h": 0,
    "size": "s",
    "color": "white",
    "value": 0,
    "hidden": true
   }
  ],
  "beats": [
   {
    "t": 0.3,
    "do": "enter",
    "a": "product",
    "b": "fourp",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "pop",
    "d": 0,
    "id": ""
   },
   {
    "t": 0.8,
    "do": "link",
    "a": "fourp",
    "b": "product",
    "x": 0,
    "y": 0,
    "text": "무엇을",
    "emoji": "",
    "value": 0,
    "style": "arrow",
    "d": 0.5,
    "id": "l1"
   },
   {
    "t": 1.5,
    "do": "enter",
    "a": "price",
    "b": "fourp",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "pop",
    "d": 0,
    "id": ""
   },
   {
    "t": 2.0,
    "do": "link",
    "a": "fourp",
    "b": "price",
    "x": 0,
    "y": 0,
    "text": "얼마에",
    "emoji": "",
    "value": 0,
    "style": "arrow",
    "d": 0.5,
    "id": "l2"
   },
   {
    "t": 2.7,
    "do": "enter",
    "a": "place",
    "b": "fourp",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "pop",
    "d": 0,
    "id": ""
   },
   {
    "t": 3.2,
    "do": "link",
    "a": "fourp",
    "b": "place",
    "x": 0,
    "y": 0,
    "text": "어디서",
    "emoji": "",
    "value": 0,
    "style": "arrow",
    "d": 0.5,
    "id": "l3"
   },
   {
    "t": 3.9,
    "do": "enter",
    "a": "promo",
    "b": "fourp",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "pop",
    "d": 0,
    "id": ""
   },
   {
    "t": 4.4,
    "do": "link",
    "a": "fourp",
    "b": "promo",
    "x": 0,
    "y": 0,
    "text": "어떻게",
    "emoji": "",
    "value": 0,
    "style": "arrow",
    "d": 0.6,
    "id": "l4"
   }
  ],
  "captions": [
   {
    "t": 0.3,
    "text": "제품은 무엇을 팔지 정해요"
   },
   {
    "t": 1.5,
    "text": "가격은 얼마에 팔지 정해요"
   },
   {
    "t": 2.7,
    "text": "유통은 어디서 팔지 정해요"
   },
   {
    "t": 3.9,
    "text": "촉진은 어떻게 알릴지 정해요"
   }
  ],
  "quiz": {
   "question": "매카시의 4P 마케팅 믹스에서 Place가 뜻하는 요소는?",
   "options": [
    "제품",
    "가격",
    "유통",
    "촉진"
   ],
   "answer": 2,
   "explanation": "Place는 유통, Promotion은 촉진이에요. 네 요소는 같은 포지셔닝을 향해 맞물려야 해요."
  }
 },
 {
  "hook": "잘 팔리는데 왜 이익은 줄까?",
  "term": "제품수명주기(PLC)",
  "definition": "시간에 따른 매출·이익 변화의 네 단계",
  "highlight": "매출·이익 변화",
  "palette": "teal",
  "actors": [
   {
    "id": "stage",
    "type": "pill",
    "emoji": "",
    "label": "도입기",
    "x": 50,
    "y": 12,
    "w": 0,
    "h": 0,
    "size": "m",
    "color": "navy",
    "value": 0,
    "hidden": false
   },
   {
    "id": "sales",
    "type": "bar",
    "emoji": "",
    "label": "매출",
    "x": 30,
    "y": 92,
    "w": 0,
    "h": 60,
    "size": "m",
    "color": "blue",
    "value": 10,
    "hidden": false
   },
   {
    "id": "profit",
    "type": "bar",
    "emoji": "",
    "label": "이익",
    "x": 70,
    "y": 92,
    "w": 0,
    "h": 60,
    "size": "m",
    "color": "green",
    "value": 0,
    "hidden": false
   }
  ],
  "beats": [
   {
    "t": 0.3,
    "do": "mark",
    "a": "profit",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "cross",
    "d": 0,
    "id": ""
   },
   {
    "t": 1.1,
    "do": "swap",
    "a": "stage",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "성장기",
    "emoji": "",
    "value": 0,
    "style": "",
    "d": 0,
    "id": ""
   },
   {
    "t": 1.5,
    "do": "grow",
    "a": "profit",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 85,
    "style": "",
    "d": 1.0,
    "id": ""
   },
   {
    "t": 1.9,
    "do": "grow",
    "a": "sales",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 60,
    "style": "",
    "d": 1.0,
    "id": ""
   },
   {
    "t": 3.1,
    "do": "swap",
    "a": "stage",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "성숙기",
    "emoji": "",
    "value": 0,
    "style": "",
    "d": 0,
    "id": ""
   },
   {
    "t": 3.5,
    "do": "grow",
    "a": "sales",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 95,
    "style": "",
    "d": 0.9,
    "id": ""
   },
   {
    "t": 3.9,
    "do": "grow",
    "a": "profit",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 45,
    "style": "",
    "d": 0.9,
    "id": ""
   },
   {
    "t": 5.0,
    "do": "glow",
    "a": "sales",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "",
    "d": 1.2,
    "id": ""
   }
  ],
  "captions": [
   {
    "t": 0.3,
    "text": "도입기, 이익은 적자"
   },
   {
    "t": 1.5,
    "text": "성장기, 이익이 먼저 치솟고"
   },
   {
    "t": 3.5,
    "text": "성숙기에 매출이 정점"
   },
   {
    "t": 3.9,
    "text": "이익은 이미 내려오는 중"
   }
  ],
  "quiz": {
   "question": "제품수명주기에서 경쟁이 가장 치열한 단계는?",
   "options": [
    "도입기",
    "성장기",
    "성숙기",
    "쇠퇴기"
   ],
   "answer": 2,
   "explanation": "성숙기엔 매출이 꼭대기를 찍고, 경쟁이 가장 치열해요."
  }
 },
 {
  "hook": "신제품, 비싸게 팔까 싸게 팔까?",
  "term": "신제품 가격 전략",
  "definition": "시작 가격을 높게 또는 낮게 정하는 전략",
  "highlight": "높게 또는 낮게",
  "palette": "orange",
  "actors": [
   {
    "id": "skim",
    "type": "card",
    "emoji": "🏷️",
    "label": "스키밍",
    "x": 22,
    "y": 20,
    "w": 0,
    "h": 0,
    "size": "m",
    "color": "white",
    "value": 0,
    "hidden": false
   },
   {
    "id": "pen",
    "type": "card",
    "emoji": "🏷️",
    "label": "침투",
    "x": 78,
    "y": 20,
    "w": 0,
    "h": 0,
    "size": "m",
    "color": "white",
    "value": 0,
    "hidden": false
   },
   {
    "id": "skimBar",
    "type": "bar",
    "emoji": "",
    "label": "가격",
    "x": 22,
    "y": 85,
    "w": 0,
    "h": 40,
    "size": "m",
    "color": "red",
    "value": 90,
    "hidden": false
   },
   {
    "id": "penBar",
    "type": "bar",
    "emoji": "",
    "label": "가격",
    "x": 78,
    "y": 85,
    "w": 0,
    "h": 40,
    "size": "m",
    "color": "blue",
    "value": 25,
    "hidden": false
   },
   {
    "id": "early",
    "type": "emoji",
    "emoji": "🤓",
    "label": "얼리어답터",
    "x": 50,
    "y": 30,
    "w": 0,
    "h": 0,
    "size": "s",
    "color": "white",
    "value": 0,
    "hidden": true
   },
   {
    "id": "share",
    "type": "emoji",
    "emoji": "👥",
    "label": "점유율",
    "x": 50,
    "y": 70,
    "w": 0,
    "h": 0,
    "size": "m",
    "color": "white",
    "value": 0,
    "hidden": true
   }
  ],
  "beats": [
   {
    "t": 0.3,
    "do": "glow",
    "a": "skimBar",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "",
    "d": 0.8,
    "id": ""
   },
   {
    "t": 1.0,
    "do": "enter",
    "a": "early",
    "b": "skim",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "pop",
    "d": 0,
    "id": ""
   },
   {
    "t": 1.6,
    "do": "send",
    "a": "early",
    "b": "skim",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "💰",
    "value": 0,
    "style": "token",
    "d": 0.9,
    "id": ""
   },
   {
    "t": 2.7,
    "do": "grow",
    "a": "skimBar",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 45,
    "style": "",
    "d": 1.4,
    "id": ""
   },
   {
    "t": 4.2,
    "do": "pulse",
    "a": "penBar",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "",
    "d": 0,
    "id": ""
   },
   {
    "t": 4.7,
    "do": "enter",
    "a": "share",
    "b": "penBar",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "left",
    "d": 0,
    "id": ""
   },
   {
    "t": 5.3,
    "do": "burst",
    "a": "share",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "",
    "d": 0,
    "id": ""
   },
   {
    "t": 5.8,
    "do": "glow",
    "a": "pen",
    "b": "",
    "x": 0,
    "y": 0,
    "text": "",
    "emoji": "",
    "value": 0,
    "style": "",
    "d": 1.1,
    "id": ""
   }
  ],
  "captions": [
   {
    "t": 0.3,
    "text": "스키밍은 높게 시작해요"
   },
   {
    "t": 1.6,
    "text": "얼리어답터가 먼저 사고"
   },
   {
    "t": 2.7,
    "text": "시간이 지나며 가격을 낮춰요"
   },
   {
    "t": 4.2,
    "text": "침투는 낮게 시작해 점유율 확보"
   }
  ],
  "quiz": {
   "question": "처음부터 낮은 가격으로 많은 고객을 확보해 시장 점유율을 먼저 차지하는 전략은?",
   "options": [
    "초기 고가 전략(스키밍)",
    "시장 침투 가격 전략",
    "규모의 경제",
    "얼리어답터 전략"
   ],
   "answer": 1,
   "explanation": "침투 전략은 낮게 시작해 넓게 깔고, 스키밍은 높게 시작해 점차 가격을 낮춰요."
  }
 }
] as unknown as Scene[];

/** 생성 기록: 걸린 시간(ms)과 입출력 글자 수 */
export const MKT_STATS = {"outlineMs": 55201, "textMs": [27032, 27734, 18409, 31218, 31188], "freeMs": [49605, 45467, 38789, 42749, 44769], "textChars": [473, 601, 507, 460, 516], "freeChars": [1930, 2227, 2111, 1724, 2210], "reqTextChars": [2208, 2391, 2056, 2215, 2090], "reqFreeChars": [6392, 6365, 6304, 6311, 6296], "outlineInChars": 4950, "outlineOutChars": 3117};
