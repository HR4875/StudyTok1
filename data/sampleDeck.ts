import type { Deck } from "@/lib/types";

// 시연용 기본 덱. AI API 장애나 한도 초과 때도 시연이 되도록 미리 만들어 정적 데이터로 둔다.
// 주제: 경제학원론 '수요와 공급' 기초. 그래프 숫자는 설명용 가상 예시다.
export const sampleDeck: Deck = {
  title: "수요와 공급, 60초 컷",
  source: "샘플",
  mode: "text",
  model: "sample",
  isSample: true,
  cards: [
    {
      id: "s1",
      kind: "hook",
      emoji: "🍗",
      title: "시험 기간, 왜 야식 배달비가 오를까?",
      body: "같은 치킨인데 밤 11시엔 배달팁이 더 붙어요. 답은 경제학 첫 장, 수요와 공급에 있어요.",
      points: [],
      visual: null,
      quiz: null,
      motion: {
        beats: [
          { text: "같은 치킨", effect: "pop" },
          { text: "다른 배달비?", effect: "zoom" },
          { text: "범인은 수요와 공급", effect: "highlight" },
        ],
        narration: "같은 치킨인데 왜 밤에는 배달비가 더 비쌀까요? 범인은 수요와 공급이에요.",
      },
      pages: null,
    },
    {
      id: "s2",
      kind: "concept",
      emoji: "📉",
      title: "수요의 법칙",
      body: "다른 조건이 같다면, 가격이 오르면 사려는 양(수요량)은 줄고 가격이 내리면 늘어나요.",
      points: ["가격 ↑ → 수요량 ↓", "가격 ↓ → 수요량 ↑", "그래서 수요곡선은 오른쪽 아래로 기울어요"],
      visual: {
        type: "bar",
        title: "치킨 가격별 주문량 (가상 예시)",
        items: [
          { label: "1만 5천원", value: 120, note: null },
          { label: "2만원", value: 80, note: null },
          { label: "2만 5천원", value: 45, note: null },
        ],
      },
      quiz: null,
      motion: {
        beats: [
          { text: "가격 ↑", effect: "slide" },
          { text: "수요량 ↓", effect: "pop" },
          { text: "곡선은 ↘", effect: "type" },
        ],
        narration: "가격이 오르면 사려는 양은 줄어요. 이게 수요의 법칙이에요.",
      },
      pages: null,
    },
    {
      id: "s3",
      kind: "concept",
      emoji: "📈",
      title: "공급의 법칙",
      body: "가격이 오르면 팔려는 양(공급량)은 늘어나요. 비싸게 팔 수 있으면 더 만들고 싶으니까요.",
      points: ["가격 ↑ → 공급량 ↑", "공급곡선은 오른쪽 위로 기울어요"],
      visual: {
        type: "compare",
        title: null,
        items: [
          { label: "수요곡선", value: null, note: "오른쪽 아래로 ↘ 사는 사람 시점" },
          { label: "공급곡선", value: null, note: "오른쪽 위로 ↗ 파는 사람 시점" },
        ],
      },
      quiz: null,
      motion: {
        beats: [
          { text: "비싸게 팔 수 있다면?", effect: "type" },
          { text: "더 만든다!", effect: "pop" },
        ],
        narration: "비싸게 팔 수 있으면 더 많이 만들고 싶겠죠. 그래서 공급곡선은 위로 올라가요.",
      },
      pages: null,
    },
    {
      id: "s4",
      kind: "quiz",
      emoji: "🧠",
      title: "수요의 법칙",
      body: "",
      points: [],
      visual: null,
      quiz: {
        question: "다른 조건이 같을 때 아메리카노 가격이 오르면, 수요량은?",
        choices: ["늘어난다", "줄어든다", "변하지 않는다", "공급량과 같아진다"],
        answer: 1,
        explanation:
          "가격이 오르면 사려는 양이 줄어드는 게 수요의 법칙이에요. '수요'가 아니라 곡선 위에서 움직이는 '수요량'이 줄어든다는 점이 포인트예요.",
      },
      motion: null,
      pages: null,
    },
    {
      id: "s5",
      kind: "concept",
      emoji: "⚖️",
      title: "균형: 두 곡선이 만나는 점",
      body: "사려는 양과 팔려는 양이 딱 같아지는 가격이 균형가격이에요. 시장은 이 점으로 끌려가요.",
      points: ["균형가격 = 수요량과 공급량이 같은 가격", "그때의 거래량 = 균형거래량"],
      visual: {
        type: "flow",
        title: "가격이 균형으로 돌아오는 과정",
        items: [
          { label: "가격이 높다", value: null, note: "팔려는 양 > 사려는 양" },
          { label: "초과공급", value: null, note: "재고가 쌓임" },
          { label: "가격 인하", value: null, note: "판매자 경쟁" },
          { label: "균형", value: null, note: "수요량 = 공급량" },
        ],
      },
      quiz: null,
      motion: {
        beats: [
          { text: "사려는 양", effect: "slide" },
          { text: "= 팔려는 양", effect: "slide" },
          { text: "균형!", effect: "zoom" },
        ],
        narration: "사려는 양과 팔려는 양이 같아지는 곳, 그게 균형이에요.",
      },
      pages: null,
    },
    {
      id: "s6",
      kind: "concept",
      emoji: "🔀",
      title: "‘수요량’ 변화 vs ‘수요’ 변화",
      body: "가격 때문에 바뀌면 곡선 위 이동(수요량 변화), 가격 말고 다른 이유로 바뀌면 곡선 자체가 이동(수요 변화)해요.",
      points: ["소득, 취향, 대체재 가격 → 곡선 이동", "시험기간 야식 수요 ↑ → 수요곡선 오른쪽 이동"],
      visual: {
        type: "keywords",
        title: "수요곡선을 움직이는 것들",
        items: [
          { label: "소득", value: null, note: null },
          { label: "취향·유행", value: null, note: null },
          { label: "대체재 가격", value: null, note: null },
          { label: "보완재 가격", value: null, note: null },
          { label: "미래 예상", value: null, note: null },
        ],
      },
      quiz: null,
      motion: {
        beats: [
          { text: "가격 → 곡선 위 이동", effect: "slide" },
          { text: "그 외 → 곡선 이동", effect: "highlight" },
        ],
        narration: "가격이 원인이면 곡선 위에서 움직이고, 다른 이유면 곡선 자체가 움직여요.",
      },
      pages: null,
    },
    {
      id: "s7",
      kind: "quiz",
      emoji: "🧠",
      title: "수요 변화",
      body: "",
      points: [],
      visual: null,
      quiz: {
        question: "시험 기간이라 밤 야식 주문이 확 늘었다. 그래프에서는?",
        choices: ["수요곡선 위에서 아래로 이동", "수요곡선이 오른쪽으로 이동", "공급곡선이 왼쪽으로 이동", "아무 변화 없음"],
        answer: 1,
        explanation:
          "가격이 아니라 '시험 기간'이라는 다른 조건 때문에 늘었으니 수요곡선 자체가 오른쪽으로 이동해요. 그 결과 균형가격(배달비)이 올라가요.",
      },
      motion: null,
      pages: null,
    },
    {
      id: "s8",
      kind: "concept",
      emoji: "🛵",
      title: "그래서 야식 배달비가 오른다",
      body: "밤에는 주문(수요)은 늘고 일하는 라이더(공급)는 줄어요. 두 곡선이 동시에 움직이니 가격이 오를 수밖에요.",
      points: ["수요곡선 → 오른쪽", "공급곡선 → 왼쪽", "균형가격 ↑↑"],
      visual: {
        type: "cycle",
        title: "밤 11시의 배달 시장",
        items: [
          { label: "주문 폭증", value: null, note: null },
          { label: "라이더 부족", value: null, note: null },
          { label: "배달비 ↑", value: null, note: null },
          { label: "라이더 유입", value: null, note: null },
        ],
      },
      quiz: null,
      motion: {
        beats: [
          { text: "주문 ↑", effect: "pop" },
          { text: "라이더 ↓", effect: "pop" },
          { text: "배달비 ↑↑", effect: "zoom" },
        ],
        narration: "주문은 늘고 라이더는 줄어요. 그래서 밤에는 배달비가 오르는 거예요.",
      },
      pages: null,
    },
    {
      id: "s9",
      kind: "quiz",
      emoji: "🧠",
      title: "균형",
      body: "",
      points: [],
      visual: null,
      quiz: {
        question: "가격이 균형가격보다 높으면 시장에는 무엇이 생길까?",
        choices: ["초과수요", "초과공급", "균형거래량 증가", "수요곡선 이동"],
        answer: 1,
        explanation:
          "가격이 높으면 팔려는 양이 사려는 양보다 많아 '초과공급'이 생겨요. 남는 물건 때문에 가격이 내려가며 균형으로 돌아가요.",
      },
      motion: null,
      pages: null,
    },
    {
      id: "s10",
      kind: "summary",
      emoji: "📌",
      title: "오늘의 3줄 요약",
      body: "이 세 줄만 기억하면 시험 첫 문제는 잡아요.",
      points: [
        "가격 ↑ → 수요량 ↓, 공급량 ↑",
        "균형 = 수요량과 공급량이 같은 점",
        "가격 외 요인은 곡선 자체를 움직인다",
      ],
      visual: {
        type: "formula",
        title: null,
        items: [{ label: "Qd(P*) = Qs(P*)", value: null, note: "P*: 균형가격, Qd: 수요량, Qs: 공급량" }],
      },
      quiz: null,
      motion: {
        beats: [
          { text: "법칙 2개", effect: "pop" },
          { text: "균형 1개", effect: "pop" },
          { text: "끝!", effect: "zoom" },
        ],
        narration: "수요와 공급의 법칙, 그리고 균형. 오늘은 이것만 기억하세요.",
      },
      pages: null,
    },
  ],
};
