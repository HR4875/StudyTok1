// 프롬프트는 한곳에 모은다. system은 바뀌지 않게 유지해야 캐시가 맞는다 (날짜·랜덤 값 넣지 않기).
import { EXAMPLE_SCENES } from "../samples";
import type { Concept, RenderMode, Scene, SceneRequest } from "../schema";
import { shuffleQuiz } from "../fallback";

/* ------------------------------------------------------------------ */
/*  1단계: 개념 뽑기                                                    */
/* ------------------------------------------------------------------ */

// 디자인 스레드 계약(prompts/1-outline-director.md)을 따른다: 개념 뽑기 + 개념별 그림 고르기를 한 번에.
export const OUTLINE_SYSTEM = `너는 대학 강의 자료를 숏폼 학습 카드로 바꾸는 편집장이다. 한 번에 두 가지를 한다.
1) 시험에 나올 핵심 개념을 정해진 개수만큼 고른다.
2) 개념마다 "어떤 그림이면 3초 안에 이해되는지" 판단해서 그림 틀 하나를 고른다.

개념 고르기
- 원문에 있는 내용만 쓴다. 원문에 없는 사실이나 숫자를 만들지 않는다.
- 서로 겹치지 않는 개념을 강의 순서대로 고른다. 표지·목차·학습 목표·복습·강의 안내·평가 방법·참고문헌은 개념으로 고르지 않는다.
- 카드 한 장으로 설명할 수 있는 크기로 고른다. 넓은 주제보다 구체적인 개념.
- 원문이 영어여도 카드는 한국어로 쓴다 (용어는 원어 병기 가능).
- term: 원문 표기 그대로, 14자 이하 (영문 병기는 빼도 된다).
- definition: 28자 이하 한 줄. 대학생이 바로 알아듣는 쉬운 말, 마침표 없이.
- explanation: 2~3문장.
- keyPoints: 시험 포인트 2~3개, 각 25자 이하. 원문의 "시험 주의", "헷갈린다" 같은 말을 우선한다.
- example: 원문 예시를 우선, 한 문장.
- visual: 이 개념을 그림으로 그리면 어떤 장면인지 한 문장.
- pages: 원문의 [p.N] 표시를 따라 "p.3" 또는 "p.3-4". 사진 자료면 "사진 2".

그림 고르기 (plan)
먼저 개념의 지식 유형(kind)을 판단하고, 표에서 그림 틀(template)을 고른다.
| kind | 이런 개념 | template |
| process | 순서가 정해진 단계·절차 | flow |
| interaction | 두 주체가 무언가를 순서대로 주고받음 | exchange |
| comparison | 두 대상의 차이·대조가 핵심 | versus |
| quantity | 양이 늘고 줄거나 두 값이 함께 움직이는 관계·추세 | chart |
| cycle | 끝이 처음으로 돌아오는 반복 | cycle |
| classification | 종류·유형·구성 요소로 나뉨 | tree |
| two-axis | 두 기준(축)으로 위치·유형을 정함 | matrix |
| formula | 계산식·비율로 정의됨 | formula |
| causal | 원인이 결과를 연쇄로 부름 | chain |
| proportion | 전체 안의 비중 | parts |
| chronology | 시간 순서의 사건·시대 | timeline |
| abstract | 위 어디에도 안 맞는 추상 개념, 일상 비유가 쉬움 | analogy |

판단 기준
- 겉 단어가 아니라 시험에서 묻는 구조를 본다. 이름에 "과정"이 들어가도 핵심이 두 방법의 차이면 comparison이다.
- 그림만 보고도 정의를 말할 수 있어야 한다. 한 화면에 요소는 5개 이하.
- 원문에 숫자가 없으면 chart·parts는 모양(추세)이 핵심일 때만 고른다.
- 같은 template이 3번 연속 나오지 않게 한다. 다만 억지로 바꾸지 말고, 둘째로 맞는 틀이 충분히 좋을 때만 바꾼다.

plan 칸
- kind, template: 위 표의 값.
- why: 이 틀을 고른 이유, 40자 이하.
- focus: 보는 사람이 꼭 알아채야 할 한 가지, 30자 이하.
- motion: 모션으로 만든다면 무엇이 어떻게 움직여야 하는지, 40자 이하.
- cast: 그림에 나올 대상 이름 2~5개, 각 8자 이하.

deckTitle: 이 자료 전체를 부를 짧은 제목 (20자 이하). subject: 과목명 (모르면 분야명). language: "ko".`;

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
    c.plan ? `그림 판단: ${JSON.stringify(c.plan)} (이 틀의 구조로 보여 주고 focus를 꼭 보여 준다. motion은 움직임 힌트)` : "",
    "",
    `위 개념으로 장면 JSON을 만들어. term은 "${c.term}" 그대로 쓴다.`,
  ];
  if (retryIssues?.length) {
    lines.push("", "앞서 만든 장면에 이런 문제가 있었다. 고쳐서 처음부터 다시 만들어:", ...retryIssues.map((i) => `- ${i}`));
  }
  return lines.filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== "")).join("\n");
}

/* ------------------------------------------------------------------ */
/*  2단계(기본): 그림 틀 칸 채우기 — 디자인 스레드 계약 prompts/2-text-short.md   */
/*  system은 틀과 상관없이 같게 두고(캐시), 고른 틀 하나의 설명·예시만 user에 넣는다 */
/* ------------------------------------------------------------------ */

export const CARD_SYSTEM = `너는 대학생용 숏폼 학습 카드 작가다. 개념 1개를 카드 1장으로 만든다. 그림은 코드가 정해진 틀로 그리니, 너는 틀의 칸만 채운다.

카드는 위에서 아래로 이렇게 보인다: 궁금증 질문(hook) → 그림 → 큰 개념 이름 → 정의 한 줄(핵심 구절에 형광펜).

칸 채우기
- hook: 22자 이하 질문. 대학생이 "어? 왜?" 하고 멈추게 한다. 답을 말하지 않는다. 일상 장면이나 의외의 사실로 시작한다.
- highlight: 주어진 definition 안에 글자 그대로 들어 있는 핵심 구절, 4~12자. (term과 definition은 이미 정해져 있으니 다시 쓰지 않는다.)
- palette: blue, violet, green, teal, orange, pink, navy, red 중 하나. 개념 분위기에 맞게 (돈·가격은 orange, 성장·자연은 green, 위험·경고는 red 등). 바로 앞 카드와 같은 색은 피한다.
- visual: 아래 [그림 틀]의 형식 그대로. 라벨은 짧은 명사구, 이모지는 뜻이 바로 보이는 것 하나.
- quiz: 4지선다 1개. question은 그림을 본 사람이 풀 수 있게. options 4개 중 오답은 같은 강의의 헷갈리는 개념이나 그럴듯한 값. answer는 정답 위치(0~3). explanation은 60자 이하.

지킬 것
- 원문(개념 설명)에 없는 사실을 만들지 않는다. 원문에 없는 숫자를 쓰면 illustrative를 true로 한다.
- hook, definition, 그림 라벨이 같은 말을 되풀이하지 않는다. 그림은 정의를 "보여 주고", 정의는 그림을 "이름 붙인다".
- 모든 칸을 채운다. 안 쓰는 칸은 "" 또는 -1.`;

type TemplateGuide = { when: string; fill: string; example: unknown };

export function cardUser(
  req: SceneRequest,
  template: string,
  guide: TemplateGuide,
  opts: { prevPalette?: string; retry?: { issues: string[]; previous: string } } = {},
): string {
  const c = req.concept;
  const concept = {
    term: c.term,
    definition: c.definition,
    explanation: c.explanation,
    keyPoints: c.keyPoints,
    example: c.example,
    visual: c.visual,
  };
  const lines = [
    `강의: ${req.deck.title}${req.deck.subject ? ` (${req.deck.subject})` : ""}`,
    `같은 강의의 다른 개념: ${req.deck.terms.filter((t) => t !== c.term).slice(0, 14).join(", ") || "없음"}`,
    `개념: ${JSON.stringify(concept)}`,
    c.plan ? `그림 판단: ${JSON.stringify({ ...c.plan, template })}` : "",
    opts.prevPalette ? `바로 앞 카드 색: ${opts.prevPalette}` : "",
    "",
    `[그림 틀: ${template}]`,
    `언제: ${guide.when}`,
    `채우는 법: ${guide.fill}`,
    `예시(다른 과목): ${JSON.stringify(guide.example)}`,
  ];
  const out = lines.filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== "")).join("\n");
  return opts.retry?.issues.length ? out + retryNote(opts.retry.issues, opts.retry.previous) : out;
}

/** 검사에 걸린 답을 한 번 고쳐 받을 때 붙이는 글 (디자인 스레드 시안 lib/prompts.ts의 retryNote와 같다) */
export function retryNote(errors: string[], previous: string): string {
  return [
    "",
    "---",
    "[이전 답의 문제] 아래를 고쳐서 JSON 전체를 다시 써.",
    ...errors.slice(0, 6).map((e) => `- ${e}`),
    ...(previous ? ["", "[이전 답]", previous.slice(0, 4000)] : []),
  ].join("\n");
}
