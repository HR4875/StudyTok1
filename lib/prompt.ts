import type { RenderMode } from "./types";

// Claude structured outputs 용 JSON 스키마. 모든 객체는 additionalProperties:false, 모든 필드 required.
const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });

const visualSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "title", "items"],
  properties: {
    type: {
      type: "string",
      enum: ["none", "bar", "pie", "flow", "cycle", "compare", "keywords", "formula", "timeline"],
    },
    title: nullable({ type: "string" }),
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "value", "note"],
        properties: {
          label: { type: "string" },
          value: nullable({ type: "number" }),
          note: nullable({ type: "string" }),
        },
      },
    },
  },
};

const quizSchema = {
  type: "object",
  additionalProperties: false,
  required: ["question", "choices", "answer", "explanation"],
  properties: {
    question: { type: "string" },
    choices: { type: "array", items: { type: "string" } },
    answer: { type: "integer" },
    explanation: { type: "string" },
  },
};

const motionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["beats", "narration"],
  properties: {
    beats: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "effect"],
        properties: {
          text: { type: "string" },
          effect: { type: "string", enum: ["pop", "slide", "type", "zoom", "highlight"] },
        },
      },
    },
    narration: { type: "string" },
  },
};

export function deckSchema(mode: RenderMode) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "cards"],
    properties: {
      title: { type: "string" },
      cards: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "kind", "emoji", "title", "subtitle", "tagline", "body", "chip", "points", "visual", "quiz", "motion", "pages",
          ],
          properties: {
            kind: { type: "string", enum: ["hook", "concept", "quiz", "summary"] },
            emoji: { type: "string" },
            title: { type: "string" },
            subtitle: nullable({ type: "string" }),
            tagline: nullable({ type: "string" }),
            body: { type: "string" },
            chip: nullable({
              type: "object",
              additionalProperties: false,
              required: ["label", "text"],
              properties: { label: { type: "string" }, text: { type: "string" } },
            }),
            points: { type: "array", items: { type: "string" } },
            visual: nullable(visualSchema),
            quiz: nullable(quizSchema),
            motion: mode === "motion" ? nullable(motionSchema) : { type: "null" },
            pages: nullable({ type: "string" }),
          },
        },
      },
    },
  };
}

export const SYSTEM_PROMPT = `당신은 대학생·수험생용 숏폼 학습 앱 "StudyTok"의 편집자입니다.
사용자가 올린 강의자료 일부를 릴스·틱톡처럼 한 장씩 넘겨 보는 학습 카드로 바꿉니다.

카드 한 장의 화면 구성 (위에서 아래로)
1) 그림(visual): 코드로 그리는 도식
2) title: 화면 가운데 아래에 아주 크게 들어가는 핵심 개념 이름. 짧을수록 좋습니다(8자 안팎, 최대 14자). 예: "STP", "포지셔닝", "수요의 법칙"
3) subtitle: 원어·영문 표기가 있으면(예: "Positioning"), 없으면 null
4) tagline: 개념을 한 줄로 잡는 문장(24자 이내). 가장 중요한 말 하나를 [[ ]] 로 감싸 형광펜 강조합니다. 예: "고객 머릿속 [[한 자리]] 차지하기"
5) body: 작은 설명 1~2문장(60자 이내)
6) chip: 예시나 비교 한 줄. label 은 "예시", "vs 다른개념", "한 줄" 같은 짧은 말, text 는 30자 이내. 필요 없으면 null

원칙
- 모두 한국어로, 휴대폰 한 화면에 들어가게 짧게 씁니다. 한 카드에는 개념 하나만 담고, 자료의 흐름 순서를 지킵니다.
- 자료에 없는 사실, 숫자, 예시를 지어내지 않습니다. 자료가 부족하면 카드를 적게 만듭니다.
- 첫 조각(조각 1)의 첫 카드는 kind "hook": title 은 호기심을 끄는 질문(14자 안팎), body 는 한 줄 부연, tagline 은 null.
- 개념 카드 2~3장마다 kind "quiz" 카드를 하나 넣습니다. 보기 4개 4지선다가 기본이고, 가끔은 choices 를 정확히 ["O","X"] 로 하는 OX 퀴즈를 씁니다. answer 는 정답 보기의 0부터 시작하는 번호. 그럴듯한 오답을 섞습니다. explanation 은 왜 그 답인지, 흔한 오해가 무엇인지 2문장. quiz 카드의 title 은 정답이 되는 개념 이름, subtitle/tagline/chip 은 null, body 는 빈 문자열.
- 마지막 조각(조각 N/N)의 마지막 카드는 kind "summary": title "오늘의 핵심", points 에 이번 자료의 핵심 개념 이름 3~5개.
- quiz 가 아닌 카드는 quiz 를 null 로 둡니다. points 는 summary 에서만 쓰고 나머지는 빈 배열.

그림(visual) - 흰 스티커 같은 도식을 코드로 그립니다. 이미지 생성은 하지 않습니다.
- 개념 카드에는 되도록 넣되, 내용과 맞지 않으면 null (그때는 emoji 가 크게 대신 들어갑니다).
- flow: 단계·절차(3~4개), cycle: 순환(3~5개), compare: 두 대상 비교(items 정확히 2개, note 에 짧은 특징), keywords: 핵심어 3~5개, formula: 공식 한 줄(items 1개, label 에 공식, note 에 기호 설명), timeline: 시간 순서, bar/pie: 자료에 실제 숫자가 있을 때만(value 에 그 숫자).
- items 의 label 은 8자 이내, note 는 14자 이내. title 은 null 로 두거나 아주 짧게.

emoji 는 카드 주제를 나타내는 이모지 1개. pages 는 근거가 된 페이지(예: "p.4"), 모르면 null.`;

export const MOTION_ADDENDUM = `
모션그래픽 모드입니다. quiz 가 아닌 카드마다 motion 을 채웁니다.
- beats: 그림 위에 말풍선으로 차례로 튀어나올 1~3개의 짧은 대사(각 12자 이내). 예: "뭐가 달라?", "콜라 시장 공략!". effect 는 pop/slide/zoom 중에서 고릅니다.
- narration: 카드를 읽어 주는 1~2문장 대사(구어체, 60자 이내).
quiz 카드의 motion 은 null.`;

export const TEXT_ADDENDUM = `
텍스트 숏츠 모드입니다. motion 은 모든 카드에서 null 로 둡니다.`;

export function userPrompt(opts: {
  docTitle: string;
  pageLabel: string;
  chunkIndex: number;
  chunkCount: number;
  text?: string;
}) {
  const where = `자료: "${opts.docTitle}" ${opts.pageLabel} (조각 ${opts.chunkIndex + 1}/${opts.chunkCount})`;
  const cardHint = "이 조각으로 카드 4~7장을 만드세요(퀴즈 포함).";
  if (opts.text) {
    return `${where}\n${cardHint}\n\n<자료>\n${opts.text}\n</자료>`;
  }
  return `${where}\n${cardHint}\n첨부한 PDF 페이지의 내용을 사용하세요.`;
}
