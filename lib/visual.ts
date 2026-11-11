import { z } from "zod";
import { PALETTES, QuizSchema, type Palette, type Quiz } from "./schema";

/* ------------------------------------------------------------------ */
/*  StudyTok 그림 틀(Visual templates) · UI와 백엔드 사이 계약           */
/*                                                                    */
/*  1) 개념 뽑기 호출(/api/outline)이 개념마다 VisualPlan을 같이 낸다:   */
/*     "이 개념은 어떤 그림이면 3초 안에 이해되나" → 틀 하나.           */
/*  2) 카드 호출(/api/card)이 그 틀의 칸만 채운다(CardFill).            */
/*  3) 그리기는 코드가 한다.                                            */
/*     - 텍스트 숏츠: TextShortCard가 정지 그림으로 렌더                 */
/*     - 모션그래픽: compileVisual()이 같은 칸으로 장면(Scene)을 만들어   */
/*       Remotion으로 재생. AI가 좌표·타이밍을 쓰지 않으니 추가 비용 0.  */
/*                                                                    */
/*  구조화 출력 호환: 모든 필드 required, 안 쓰는 칸은 "" 또는 -1.       */
/*  개수·글자 수 제한은 API 스키마가 아니라 LIMITS + validateVisual()로. */
/* ------------------------------------------------------------------ */

export const VISUAL_TEMPLATES = [
  "flow",
  "exchange",
  "versus",
  "chart",
  "cycle",
  "tree",
  "matrix",
  "formula",
  "chain",
  "parts",
  "timeline",
  "analogy",
] as const;
export type VisualTemplate = (typeof VISUAL_TEMPLATES)[number];

export const KNOWLEDGE_KINDS = [
  "process",
  "interaction",
  "comparison",
  "quantity",
  "cycle",
  "classification",
  "two-axis",
  "formula",
  "causal",
  "proportion",
  "chronology",
  "abstract",
] as const;
export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number];

/** 판단 표: 지식 유형 → 기본 그림 틀 */
export const KIND_TO_TEMPLATE: Record<KnowledgeKind, VisualTemplate> = {
  process: "flow",
  interaction: "exchange",
  comparison: "versus",
  quantity: "chart",
  cycle: "cycle",
  classification: "tree",
  "two-axis": "matrix",
  formula: "formula",
  causal: "chain",
  proportion: "parts",
  chronology: "timeline",
  abstract: "analogy",
};

/** 화면·로딩 칩에 쓰는 한글 이름 */
export const TEMPLATE_LABEL: Record<VisualTemplate, string> = {
  flow: "단계",
  exchange: "주고받기",
  versus: "비교",
  chart: "그래프",
  cycle: "순환",
  tree: "분류",
  matrix: "2축 지도",
  formula: "공식",
  chain: "원인→결과",
  parts: "비율",
  timeline: "연표",
  analogy: "비유",
};

/** 수치 틀: 자료에 숫자가 없으면 서버 규칙 검사에서 다른 틀로 바꿀 후보 */
export const NUMERIC_TEMPLATES: VisualTemplate[] = ["chart", "parts"];
/** 수치 틀을 바꿀 때 대신 쓸 틀 */
export const NUMERIC_FALLBACK: Record<string, VisualTemplate> = { chart: "flow", parts: "tree" };

/* ------------------------------------------------------------------ */
/*  제한 (개수·글자 수). API 스키마 대신 여기서 검사한다.                */
/* ------------------------------------------------------------------ */

export const LIMITS = {
  hook: 22,
  definition: 28,
  highlight: [4, 12] as const,
  quizExplanation: 60,
  label: 8,
  sub: 12,
  count: {
    flow: [3, 5],
    exchange: [2, 4], // messages
    versus: [1, 3], // rows
    chart: [2, 6], // categories (series 1~2)
    cycle: [3, 5],
    tree: [2, 4],
    matrix: [1, 5],
    formula: [2, 3],
    chain: [3, 4],
    parts: [2, 5],
    timeline: [3, 5],
    analogy: [1, 1],
  } as Record<VisualTemplate, readonly [number, number]>,
} as const;

/* ------------------------------------------------------------------ */
/*  스키마                                                             */
/* ------------------------------------------------------------------ */

const Item = z.object({
  emoji: z.string().describe("뜻이 바로 보이는 이모지 1개"),
  label: z.string().describe("8자 이하 이름"),
  sub: z.string().describe("12자 이하 한 줄 설명, 없으면 ''"),
});
const Spot = z.object({
  emoji: z.string(),
  label: z.string().describe("6자 이하"),
  x: z.number().describe("0~100, 오른쪽이 high"),
  y: z.number().describe("0~100, 위쪽이 high"),
});
const Axis = z.object({ name: z.string(), low: z.string().describe("6자 이하"), high: z.string().describe("6자 이하") });
const Focus = z.number().describe("강조할 항목 번호(0부터), 없으면 -1");

export const FlowVisual = z.object({ type: z.literal("flow"), steps: z.array(Item).describe("3~5단계, 순서대로"), focus: Focus });
export const ExchangeVisual = z.object({
  type: z.literal("exchange"),
  left: Item,
  right: Item,
  messages: z.array(z.object({ from: z.enum(["left", "right"]), text: z.string().describe("14자 이하") })).describe("2~4개, 주고받는 순서대로"),
});
export const VersusVisual = z.object({
  type: z.literal("versus"),
  a: Item,
  b: Item,
  rows: z
    .array(z.object({ name: z.string().describe("6자 이하 비교 기준"), a: z.string().describe("10자 이하"), b: z.string().describe("10자 이하") }))
    .describe("1~3개, 차이가 분명한 기준만"),
});
export const ChartVisual = z.object({
  type: z.literal("chart"),
  kind: z.enum(["bar", "line"]),
  xLabel: z.string(),
  yLabel: z.string(),
  categories: z.array(z.string().describe("6자 이하")).describe("x축 항목 2~6개"),
  series: z
    .array(z.object({ name: z.string(), values: z.array(z.number()).describe("categories와 같은 개수") }))
    .describe("1~2개"),
  focus: Focus,
  note: z.string().describe("focus 지점 메모 14자 이하, 없으면 ''"),
  illustrative: z.boolean().describe("원문에 없는 예시 값이면 true"),
});
export const CycleVisual = z.object({
  type: z.literal("cycle"),
  nodes: z.array(Item).describe("3~5개, 도는 순서대로"),
  center: z.string().describe("가운데 글자 8자 이하, 없으면 ''"),
});
export const TreeVisual = z.object({ type: z.literal("tree"), root: Item, children: z.array(Item).describe("2~4개") });
export const MatrixVisual = z.object({
  type: z.literal("matrix"),
  x: Axis,
  y: Axis,
  items: z.array(Spot).describe("1~5개"),
  focus: Focus,
  gap: Spot.describe("비어 있는 기회 자리, 없으면 label ''"),
});
export const FormulaVisual = z.object({
  type: z.literal("formula"),
  result: z.string(),
  op: z.enum(["÷", "×", "+", "−"]),
  terms: z.array(z.object({ text: z.string().describe("8자 이하"), note: z.string().describe("10자 이하") })).describe("2~3개"),
  example: z.string().describe("숫자 예시 26자 이하, 없으면 ''"),
});
export const ChainVisual = z.object({ type: z.literal("chain"), links: z.array(Item).describe("3~4개, 원인부터") });
export const PartsVisual = z.object({
  type: z.literal("parts"),
  whole: z.string(),
  parts: z.array(z.object({ emoji: z.string(), label: z.string().describe("6자 이하"), value: z.number() })).describe("2~5개, 합 100"),
  focus: Focus,
  illustrative: z.boolean(),
});
export const TimelineVisual = z.object({
  type: z.literal("timeline"),
  events: z.array(z.object({ when: z.string().describe("6자 이하"), label: z.string().describe("8자 이하"), emoji: z.string() })).describe("3~5개"),
  focus: Focus,
});
export const AnalogyVisual = z.object({
  type: z.literal("analogy"),
  thing: Item,
  like: Item,
  because: z.string().describe("공통점 18자 이하"),
});

export const VISUAL_SCHEMAS = {
  flow: FlowVisual,
  exchange: ExchangeVisual,
  versus: VersusVisual,
  chart: ChartVisual,
  cycle: CycleVisual,
  tree: TreeVisual,
  matrix: MatrixVisual,
  formula: FormulaVisual,
  chain: ChainVisual,
  parts: PartsVisual,
  timeline: TimelineVisual,
  analogy: AnalogyVisual,
} as const;

export const VisualSchema = z.discriminatedUnion("type", [
  FlowVisual,
  ExchangeVisual,
  VersusVisual,
  ChartVisual,
  CycleVisual,
  TreeVisual,
  MatrixVisual,
  FormulaVisual,
  ChainVisual,
  PartsVisual,
  TimelineVisual,
  AnalogyVisual,
]);
export type Visual = z.infer<typeof VisualSchema>;
export type VisualOf<T extends VisualTemplate> = Extract<Visual, { type: T }>;

/** 개념별 그림 판단. ConceptSchema에 plan으로 붙는다. */
export const VisualPlanSchema = z.object({
  kind: z.enum(KNOWLEDGE_KINDS),
  template: z.enum(VISUAL_TEMPLATES),
  why: z.string().describe("이 틀을 고른 이유, 40자 이하"),
  focus: z.string().describe("보는 사람이 꼭 알아채야 할 한 가지, 30자 이하"),
  motion: z.string().describe("모션이라면 무엇이 어떻게 움직이는지, 40자 이하"),
  cast: z.array(z.string()).describe("그림에 나올 대상 이름 2~5개, 각 8자 이하"),
});
export type VisualPlan = z.infer<typeof VisualPlanSchema>;

/** 카드 호출(/api/card)이 돌려주는 묶음. 스키마는 template마다 visual만 바꿔 끼운다. */
export function cardFillSchema<T extends VisualTemplate>(template: T) {
  return z.object({
    hook: z.string().describe("22자 이하 궁금증 질문, 답을 말하지 않음"),
    highlight: z.string().describe("definition 안에 글자 그대로 있는 4~12자 구절"),
    palette: z.enum(PALETTES),
    visual: VISUAL_SCHEMAS[template],
    quiz: QuizSchema,
  });
}
export const CardFillSchema = z.object({
  hook: z.string(),
  highlight: z.string(),
  palette: z.enum(PALETTES),
  visual: VisualSchema,
  quiz: QuizSchema,
});
export type CardFill = z.infer<typeof CardFillSchema>;

/** 렌더러 입력: 개념(term·definition) + 카드 묶음 */
export interface TextShort {
  hook: string;
  term: string;
  definition: string;
  highlight: string;
  palette: Palette;
  visual: Visual;
  quiz: Quiz;
}
export const toTextShort = (concept: { term: string; definition: string }, fill: CardFill): TextShort => ({
  term: concept.term,
  definition: concept.definition,
  ...fill,
});

/* ------------------------------------------------------------------ */
/*  검사                                                               */
/*  validateVisual: 틀 규칙 위반(재생성 사유)                            */
/*  lintShort: 글자 수 같은 가벼운 경고(렌더러가 줄여서 보여 줌)           */
/*  repairShort: 고칠 수 있는 것은 고쳐서 재생성 비용을 아낌               */
/* ------------------------------------------------------------------ */

const len = (s: string) => Array.from(s ?? "").length;

function countOf(v: Visual): number {
  switch (v.type) {
    case "flow":
      return v.steps.length;
    case "exchange":
      return v.messages.length;
    case "versus":
      return v.rows.length;
    case "chart":
      return v.categories.length;
    case "cycle":
      return v.nodes.length;
    case "tree":
      return v.children.length;
    case "matrix":
      return v.items.length;
    case "formula":
      return v.terms.length;
    case "chain":
      return v.links.length;
    case "parts":
      return v.parts.length;
    case "timeline":
      return v.events.length;
    case "analogy":
      return 1;
  }
}

export function validateVisual(template: VisualTemplate, data: unknown): string[] {
  const parsed = VISUAL_SCHEMAS[template].safeParse(data);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const v = parsed.data as Visual;
  const e: string[] = [];
  const [lo, hi] = LIMITS.count[template];
  const n = countOf(v);
  if (n < lo || n > hi) e.push(`${template} 항목 ${n}개 (${lo}~${hi}개)`);
  if (v.type === "chart") {
    if (v.series.length < 1 || v.series.length > 2) e.push(`chart series ${v.series.length}개 (1~2개)`);
    v.series.forEach((s, i) => {
      if (s.values.length !== v.categories.length) e.push(`chart series[${i}] 값 ${s.values.length}개 ≠ categories ${v.categories.length}개`);
    });
  }
  if (v.type === "parts") {
    const sum = v.parts.reduce((a, p) => a + p.value, 0);
    if (sum < 90 || sum > 110) e.push(`parts 합 ${sum} (100 근처여야 함)`);
  }
  if (v.type === "matrix") {
    v.items.forEach((it, i) => {
      if (it.x < 0 || it.x > 100 || it.y < 0 || it.y > 100) e.push(`matrix items[${i}] 좌표 범위 밖`);
    });
  }
  if (v.type === "exchange" && !v.messages.some((m) => m.from === "right")) e.push("exchange: 한쪽만 보냄");
  return e;
}

export function lintShort(s: TextShort): string[] {
  const w: string[] = [];
  if (len(s.hook) > LIMITS.hook + 2) w.push(`hook ${len(s.hook)}자`);
  if (len(s.definition) > LIMITS.definition + 2) w.push(`definition ${len(s.definition)}자`);
  if (!s.highlight || !s.definition.includes(s.highlight)) w.push("highlight가 definition 안에 없음");
  if (s.quiz.options.length !== 4) w.push("퀴즈 보기 4개 아님");
  if (s.quiz.answer < 0 || s.quiz.answer > 3) w.push("퀴즈 answer 범위 밖");
  if (len(s.quiz.explanation) > LIMITS.quizExplanation + 10) w.push(`퀴즈 해설 ${len(s.quiz.explanation)}자`);
  const long = (t: string, max: number, where: string) => {
    if (len(t) > max) w.push(`${where} "${t}" ${len(t)}자`);
  };
  const v = s.visual;
  const items: { label: string; sub?: string }[] =
    v.type === "flow"
      ? v.steps
      : v.type === "cycle"
        ? v.nodes
        : v.type === "tree"
          ? [v.root, ...v.children]
          : v.type === "chain"
            ? v.links
            : v.type === "versus"
              ? [v.a, v.b]
              : v.type === "exchange"
                ? [v.left, v.right]
                : v.type === "analogy"
                  ? [v.thing, v.like]
                  : [];
  items.forEach((it, i) => {
    long(it.label, LIMITS.label + 2, `label[${i}]`);
    if (it.sub) long(it.sub, LIMITS.sub + 3, `sub[${i}]`);
  });
  if (v.type === "exchange") v.messages.forEach((m, i) => long(m.text, 15, `message[${i}]`));
  if (v.type === "versus") v.rows.forEach((r, i) => (long(r.a, 11, `rows[${i}].a`), long(r.b, 11, `rows[${i}].b`)));
  if (v.type === "chart") long(v.note, 16, "note");
  if (v.type === "formula") long(v.example, 28, "example");
  return w;
}

export function repairShort(s: TextShort): TextShort {
  let { highlight } = s;
  if (!highlight || !s.definition.includes(highlight)) {
    // 정의 끝 두 어절을 형광펜으로 (보통 핵심 서술부)
    highlight = s.definition.split(" ").slice(-2).join(" ");
  }
  const v = { ...s.visual } as Visual;
  const clampFocus = (f: number, n: number) => (f >= 0 && f < n ? f : -1);
  if (v.type === "flow") v.focus = clampFocus(v.focus, v.steps.length);
  if (v.type === "chart") {
    v.focus = clampFocus(v.focus, v.categories.length);
    v.series = v.series.slice(0, 2).map((sr) => ({ ...sr, values: v.categories.map((_, i) => sr.values[i] ?? sr.values[sr.values.length - 1] ?? 0) }));
  }
  if (v.type === "matrix") {
    v.focus = clampFocus(v.focus, v.items.length);
    v.items = v.items.slice(0, 5).map((it) => ({ ...it, x: Math.max(0, Math.min(100, it.x)), y: Math.max(0, Math.min(100, it.y)) }));
  }
  if (v.type === "parts") v.focus = clampFocus(v.focus, v.parts.length);
  if (v.type === "timeline") v.focus = clampFocus(v.focus, v.events.length);
  return { ...s, highlight, visual: v };
}
