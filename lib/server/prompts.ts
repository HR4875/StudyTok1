// 프롬프트는 한곳에 모은다. system은 바뀌지 않게 유지해야 캐시가 맞는다 (날짜·랜덤 값 넣지 않기).
import { EXAMPLE_SCENES } from "../samples";
import type { Concept, RenderMode, Scene, SceneRequest } from "../schema";
import { shuffleQuiz } from "../fallback";

/* ------------------------------------------------------------------ */
/*  1단계: 개념 뽑기                                                    */
/* ------------------------------------------------------------------ */

export const OUTLINE_SYSTEM = `너는 대학 강의자료를 숏폼 학습 카드로 바꾸는 편집자다. 받은 쪽들에서 시험에 나올 핵심 개념을 뽑아 JSON으로 낸다.

개념 고르기
- 요청한 개수만큼, 자료에 나온 순서대로 뽑는다. 자료가 부족하면 더 적게 낸다.
- 강의 안내, 평가 방법, 일정, 목차, 참고문헌, 인사말, 저작권 문구는 개념이 아니다.
- 카드 한 장으로 설명할 수 있는 크기로 고른다. "마케팅"처럼 넓은 주제보다 "STP 전략", "포지셔닝"처럼 구체적인 개념.
- 서로 겹치는 개념은 하나로 합친다. 같은 개념의 하위 항목은 keyPoints에 넣는다.

칸별 규칙 (모두 한국어, 자료가 영어여도 카드는 한국어로. 용어는 원어 병기 가능)
- term: 자료에 쓰인 이름 그대로, 14자 이하. 약어는 그대로 둔다 (예: "SWOT 분석").
- definition: 처음 배우는 사람도 바로 알아듣는 한 줄, 28자 이하. 마침표 없이.
- explanation: 2~4문장. 자료 내용에 충실하게 쓰고, 자료에 없는 숫자나 사실을 지어내지 않는다.
- keyPoints: 시험에 나올 포인트 2~4개, 각각 40자 이하.
- example: 대학생 생활에 가까운 구체적인 예 1~2문장.
- visual: 이 개념을 가장 빨리 이해시키는 그림 하나를 고른다. 먼저 그림 유형(흐름·단계, 비교, 분류·계층, 2축 지도, 그래프·추세, 순환, 인과, 타임라인, 구조·구성요소, 비유 중 하나)을 정하고, 무엇이 화면에 있고 무엇이 어떻게 변하는지 1~2문장으로 구체적으로 쓴다. 예: "흐름: 앱과 서버 사이 통로로 요청 말풍선이 가고 응답이 돌아온다".
- pages: 근거가 있는 쪽. 자료의 [p.N] 표시를 따라 "p.12" 또는 "p.12-13". 사진 자료면 "사진 2".
- deckTitle: 이 자료 전체를 부를 짧은 제목 (20자 이하). subject: 과목명 (모르면 분야명). language: "ko".`;

export function outlineUser(opts: { name: string; quota: number; pageLabel: string; hasImages: boolean }): string {
  return [
    `파일 이름: ${opts.name}`,
    `범위: ${opts.pageLabel}`,
    `이 범위에서 핵심 개념을 정확히 ${opts.quota}개 뽑아 줘.`,
    opts.hasImages ? "그림으로 된 쪽은 그림 속 글자와 도표를 읽어서 쓴다." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------------------------------------------------------ */
/*  2단계: 개념별 장면                                                  */
/* ------------------------------------------------------------------ */

const SCENE_CORE = `너는 대학생용 숏폼 학습 영상을 설계하는 모션 디자이너다. 개념 하나를 10초 안팎의 세로 영상 장면 JSON으로 만든다.
렌더러가 아래 규칙대로 그리므로 스키마에 맞는 JSON 하나만 낸다. 쓰지 않는 칸은 "" 또는 0으로 채운다.

영상 구조 (렌더러가 자동으로 처리)
1. 훅 2초: hook 질문이 화면 가운데 크게 떴다가 사라진다.
2. 도식: 무대에 actors가 나타나고 beats대로 움직인다. captions가 무대 아래에 차례로 뜬다.
3. 용어 슬램: term이 크게 찍히고 definition이 올라오며 highlight 구절에 형광펜이 그어진다.

좋은 장면의 기준
- 그림만 봐도 개념이 "어떻게 작동하는지" 짐작되어야 한다. 개념과 상관없는 장식(반짝이, 아무 의미 없는 이모지)은 넣지 않는다.
- 개념 설명에 있는 진짜 등장인물·물건·숫자를 액터로 쓴다. 숫자가 있는 개념이면 number나 bar로 보여 준다.
- 왼쪽→오른쪽, 위→아래로 읽히게 놓는다. 시선이 무대 가운데에 모이게 한다.
- 대학생이 쇼츠를 넘기다 멈출 만큼 hook이 궁금해야 한다. 정답을 hook에 미리 쓰지 않는다.

글자 길이
- hook: 20자 이하 질문 (예: "날씨 앱은 날씨를 어떻게 알까?").
- term: 받은 개념 이름 그대로.
- definition: 28자 이하 한 줄. highlight는 definition 안에 글자 그대로 들어 있는 핵심 구절 (2~10자).
- 액터 label: 10자 이하. captions: 2~4개, 각 22자 이하, 장면 흐름을 따라 설명한다.

무대 좌표: x 0(왼쪽)~100(오른쪽), y 0(위)~100(아래). 무대 크기는 가로 960 × 세로 860px.
액터 type
- card: 둥근 카드 안 이모지 + 아래 label. 주인공·장소·물건. size s 190 / m 250 / l 320px.
- circle: 둥근 원 안 이모지 + label.
- emoji: 큰 이모지 (+label).
- pill: 알약 모양 글자 상자. label이 곧 글자 (emoji를 앞에 붙일 수 있음). 이름표·조건·결과.
- text: 테두리 없는 큰 글자 (label).
- number: 숫자. value가 시작값, label은 단위 ("원", "%"). count 비트로 값이 변한다.
- bar: 막대. y는 막대 바닥선, h는 최대 높이(무대 단위), value는 채움 0~100. grow 비트로 변한다. 여러 개를 나란히 놓으면 그래프.
- zone: 영역 상자. x,y가 중심, w,h가 크기(무대 단위). 그룹·시장·범위. label은 영역 이름. 다른 액터를 그 안에 놓는다.
- color: 채움색 white|yellow|blue|green|red|purple|orange|navy. 가장 중요한 액터 하나만 yellow로.
- hidden: true면 enter 비트 전까지 보이지 않는다.
- 겹치지 않게 놓는다. card·circle끼리는 가로 25 이상 또는 세로 30 이상 떨어뜨린다.

비트 (t는 도식이 시작된 뒤 초, d는 걸리는 시간 초, 0이면 기본값)
- enter: hidden 액터 a를 등장시킨다. style pop|left|right|up|down|fade|drop. b를 주면 b에서 튀어나온다.
- exit: a를 퇴장시킨다. a에 link의 id를 주면 그 화살표가 사라진다.
- move: a를 (x,y)로 옮긴다.
- send: a에서 b로 말풍선·물건을 날린다. style bubble(질문 말풍선)|answer(답 말풍선)|token(emoji 하나)|pill. text나 emoji를 채운다.
- link: a에서 b로 선을 긋는다. style arrow|line|flow(흐르는 점선)|both(양방향). text는 선 위 이름, id는 꼭 채운다.
- pulse(한 번 통통), glow(d 동안 빛남), shake(흔들림): 강조.
- swap: a의 이모지(emoji)와 라벨(text)을 바꾼다. 상태 변화.
- count: number a를 value까지 센다. grow: bar a를 value(0~100)까지 키우거나 줄인다.
- mark: a에 체크(style check) 또는 엑스(style cross). dim: a를 흐리게(on) / 되돌리기(off). burst: a에서 반짝 터짐 (결과가 나올 때 한 번만).
- a, b는 actors의 id여야 한다. 비트는 t 순서대로, 마지막 비트가 8초 안에 끝나게 한다.

퀴즈
- 개념을 이해했는지 확인하는 4지선다. 정의를 그대로 묻기보다 상황에 적용하는 질문이 좋다.
- options는 4개, 서로 겹치지 않고, 오답도 그럴듯하게 (흔한 착각을 오답으로). 각 보기 30자 이하.
- answer는 정답 보기의 번호(0~3). explanation은 왜 정답인지 1~2문장.

palette (배경 색): blue|violet|green|teal|orange|pink|navy|red. 개념 분위기에 맞게 고르고, 바로 앞 카드와 같은 색은 피한다.`;

const MOTION_RULES = `이번 카드는 모션 모드다.
- 움직임이 핵심이다. 비트 6~12개로 원인→결과, 흐름, 변화 과정을 차례로 보여 준다.
- 처음엔 꼭 필요한 액터만 보이고, 나머지는 hidden으로 두었다가 enter로 등장시킨다.
- send·move·link·count·grow·swap으로 과정을 보여 주고, 마지막에 결과를 glow·mark·burst로 강조한다.
- captions는 비트와 같은 순간에 바뀌게 t를 맞춘다.`;

const TEXT_RULES = `이번 카드는 텍스트 숏츠 모드다 (빠르고 싼 버전).
- 한 장짜리 인포그래픽처럼 만든다. 액터는 모두 처음부터 보인다 (hidden false). enter·move·send·exit·swap은 쓰지 않는다.
- 도식은 표·비교·흐름도·그래프 중 개념에 맞는 하나로 짠다. zone으로 칸을 나누고, pill·text로 핵심 글자를, bar·number로 수치를 보여 준다.
- 비트는 2~6개, 강조용만 쓴다: link(화살표 긋기), glow, pulse, mark, dim, count, grow.
- captions 2~3개.`;

/** 모션 예시 2개 + 텍스트 예시 1개. 정답 위치가 늘 0번이 되지 않게 섞어서 보여 준다. */
function exampleJson(s: Scene, seed: number): string {
  let x = seed;
  const rand = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  return JSON.stringify({ ...s, quiz: shuffleQuiz(s.quiz, rand) });
}

const TEXT_EXAMPLE: Scene = {
  hook: "공부 대신 영화를 보면 뭘 잃을까?",
  term: "기회비용",
  definition: "포기한 것 중 가장 큰 가치",
  highlight: "가장 큰 가치",
  palette: "teal",
  actors: [
    { id: "pick", type: "card", emoji: "🎬", label: "선택: 영화", x: 22, y: 50, w: 0, h: 0, size: "m", color: "white", value: 0, hidden: false },
    { id: "study", type: "card", emoji: "📚", label: "공부 1만원", x: 76, y: 16, w: 0, h: 0, size: "s", color: "white", value: 0, hidden: false },
    { id: "job", type: "card", emoji: "💼", label: "알바 2만원", x: 76, y: 50, w: 0, h: 0, size: "s", color: "yellow", value: 0, hidden: false },
    { id: "nap", type: "card", emoji: "😴", label: "낮잠 5천원", x: 76, y: 84, w: 0, h: 0, size: "s", color: "white", value: 0, hidden: false },
  ],
  beats: [
    { t: 0.3, do: "link", a: "pick", b: "study", x: 0, y: 0, text: "포기", emoji: "", value: 0, style: "line", d: 0.4, id: "l1" },
    { t: 0.5, do: "link", a: "pick", b: "job", x: 0, y: 0, text: "포기", emoji: "", value: 0, style: "line", d: 0.4, id: "l2" },
    { t: 0.7, do: "link", a: "pick", b: "nap", x: 0, y: 0, text: "포기", emoji: "", value: 0, style: "line", d: 0.4, id: "l3" },
    { t: 1.8, do: "dim", a: "study", b: "", x: 0, y: 0, text: "", emoji: "", value: 0, style: "on", d: 0, id: "" },
    { t: 1.8, do: "dim", a: "nap", b: "", x: 0, y: 0, text: "", emoji: "", value: 0, style: "on", d: 0, id: "" },
    { t: 2.2, do: "glow", a: "job", b: "", x: 0, y: 0, text: "", emoji: "", value: 0, style: "", d: 1.4, id: "" },
  ],
  captions: [
    { t: 0.2, text: "영화를 고르면 나머지는 포기" },
    { t: 1.8, text: "포기한 것 중 가장 값진 것" },
    { t: 2.6, text: "알바 2만원이 기회비용!" },
  ],
  quiz: {
    question: "영화를 보느라 공부(1만원), 알바(2만원), 낮잠(5천원)을 포기했다면 기회비용은?",
    options: ["알바로 벌 2만원", "세 가지를 더한 3만5천원", "공부의 가치 1만원", "영화표 값만큼"],
    answer: 0,
    explanation: "기회비용은 포기한 대안 가운데 가장 큰 가치 하나예요. 모두 더하지 않아요.",
  },
};

export const SCENE_SYSTEM: Record<RenderMode, string> = {
  motion: [
    SCENE_CORE,
    MOTION_RULES,
    `예시 1 (API)\n${exampleJson(EXAMPLE_SCENES.api, 7)}`,
    `예시 2 (FOB)\n${exampleJson(EXAMPLE_SCENES.fob, 11)}`,
  ].join("\n\n"),
  text: [SCENE_CORE, TEXT_RULES, `예시 (기회비용)\n${exampleJson(TEXT_EXAMPLE, 5)}`].join("\n\n"),
};

export function sceneUser(req: SceneRequest, retryIssues?: string[]): string {
  const c: Concept = req.concept;
  const lines = [
    `자료: ${req.deck.title}${req.deck.subject ? ` (${req.deck.subject})` : ""}`,
    `카드 ${req.index + 1}/${req.total}. 같은 자료의 다른 개념: ${req.deck.terms.filter((t) => t !== c.term).slice(0, 14).join(", ") || "없음"}`,
    "",
    `개념: ${c.term}`,
    `정의: ${c.definition}`,
    c.explanation ? `설명: ${c.explanation}` : "",
    c.keyPoints.length ? `시험 포인트:\n${c.keyPoints.map((k) => `- ${k}`).join("\n")}` : "",
    c.example ? `예시: ${c.example}` : "",
    c.visual ? `그림 아이디어: ${c.visual}` : "",
    "",
    `위 개념으로 장면 JSON을 만들어. term은 "${c.term}" 그대로 쓴다.`,
  ];
  if (retryIssues?.length) {
    lines.push("", "앞서 만든 장면에 이런 문제가 있었다. 고쳐서 처음부터 다시 만들어:", ...retryIssues.map((i) => `- ${i}`));
  }
  return lines.filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== "")).join("\n");
}
