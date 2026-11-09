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
          required: ["kind", "emoji", "title", "body", "points", "visual", "quiz", "motion", "pages"],
          properties: {
            kind: { type: "string", enum: ["hook", "concept", "quiz", "summary"] },
            emoji: { type: "string" },
            title: { type: "string" },
            body: { type: "string" },
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

원칙
- 모든 카드는 한국어로, 휴대폰 한 화면에 다 들어가게 짧게 씁니다. title 은 20자 안팎, body 는 2~3문장(최대 120자), points 는 0~3개의 짧은 구절.
- 한 카드에는 개념 하나만 담습니다. 자료의 흐름 순서를 지킵니다.
- 자료에 없는 사실, 숫자, 예시를 지어내지 않습니다. 자료가 부족하면 카드를 적게 만듭니다.
- 첫 조각(chunk 1)의 첫 카드는 kind "hook": 왜 이걸 알아야 하는지 호기심을 끄는 질문 한 줄.
- 개념 카드 2~3장마다 kind "quiz" 카드를 하나 넣습니다. 보기는 4개, 그럴듯한 오답을 섞고, answer 는 정답 보기의 0부터 시작하는 번호입니다. explanation 은 왜 그 답인지, 흔한 오해가 무엇인지 2문장으로 씁니다. quiz 카드의 title 은 짧은 주제명, body 는 빈 문자열.
- 마지막 조각(chunk N/N)의 마지막 카드는 kind "summary": 핵심 3줄 요약을 points 에 담습니다.
- quiz 가 아닌 카드는 quiz 를 null 로 둡니다.

그림(visual) - 코드로 그리는 가벼운 도식입니다. 이미지 생성은 하지 않습니다.
- 내용에 맞는 도식이 있을 때만 넣고, 억지로 넣지 않습니다(그럴 땐 null).
- flow: 단계·절차, cycle: 순환, compare: 두 대상 비교(items 정확히 2개, note 에 특징), keywords: 핵심어 3~5개, formula: 공식 한 줄(items 1개, label 에 공식, note 에 기호 설명), timeline: 시간 순서, bar/pie: 자료에 실제 숫자가 있을 때만(value 에 그 숫자).
- items 의 label 은 12자 이내.

emoji 는 카드 주제를 나타내는 이모지 1개. pages 는 근거가 된 페이지(예: "p.4"), 모르면 null.`;

export const MOTION_ADDENDUM = `
모션그래픽 모드입니다. quiz 가 아닌 카드마다 motion 을 채웁니다.
- beats: 화면에 차례로 등장할 2~4개의 짧은 문구(각 18자 이내). 핵심어가 하나씩 터지듯 등장하는 흐름으로 짭니다. effect 는 pop/slide/type/zoom/highlight 중에서 리듬감 있게 섞습니다.
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
