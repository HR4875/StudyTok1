import { shuffleQuiz, spreadPalettes } from "./normalize";
import type { Concept } from "./schema";
import {
  KIND_TO_TEMPLATE,
  KNOWLEDGE_KINDS,
  LIMITS,
  NUMERIC_FALLBACK,
  NUMERIC_TEMPLATES,
  VISUAL_TEMPLATES,
  cardFillSchema,
  lintShort,
  repairShort,
  toTextShort,
  validateVisual,
  type KnowledgeKind,
  type TextShort,
  type Visual,
  type VisualPlan,
  type VisualTemplate,
} from "./visual";

/* ------------------------------------------------------------------ */
/*  생성 결과 다듬기 (서버 규칙). 백엔드 /api/outline · /api/card 에서도   */
/*  같은 함수를 그대로 쓰면 된다. AI를 다시 부르지 않고 고칠 수 있는 것은  */
/*  여기서 고쳐서 재생성 비용을 아낀다.                                 */
/* ------------------------------------------------------------------ */

export type PlannedConcept = Concept & { plan: VisualPlan };

const ALT: Partial<Record<VisualTemplate, VisualTemplate>> = { flow: "chain", chain: "flow", cycle: "flow", timeline: "flow" };
const hasDigits = (s: string) => /\d/.test(s);
const conceptText = (c: Concept) => [c.definition, c.explanation, c.example, ...(c.keyPoints ?? [])].join(" ");
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

/** 1단계(개념 + 그림 판단) 결과를 받아서 빈칸을 채우고 서버 규칙을 적용한다 */
export function checkOutline(raw: unknown, count: number): { deckTitle: string; subject: string; concepts: PlannedConcept[]; notes: string[] } {
  const o = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(o.concepts) ? (o.concepts as Record<string, unknown>[]) : [];
  const notes: string[] = [];
  const concepts: PlannedConcept[] = [];
  for (const c of list) {
    const term = str(c.term).trim();
    if (!term) continue;
    const p = (c.plan ?? {}) as Record<string, unknown>;
    const kind = (KNOWLEDGE_KINDS as readonly string[]).includes(str(p.kind)) ? (p.kind as KnowledgeKind) : "abstract";
    let template = (VISUAL_TEMPLATES as readonly string[]).includes(str(p.template)) ? (p.template as VisualTemplate) : KIND_TO_TEMPLATE[kind];
    const concept: Concept = {
      term,
      definition: str(c.definition).trim(),
      explanation: str(c.explanation).trim(),
      keyPoints: Array.isArray(c.keyPoints) ? (c.keyPoints as unknown[]).map((k) => str(k)).filter(Boolean).slice(0, 3) : [],
      example: str(c.example).trim(),
      visual: str(c.visual).trim(),
      pages: str(c.pages).trim(),
    };
    // 수치 틀인데 원문에 숫자가 없으면: 비율(parts)은 뜻이 없으니 분류로, 그래프는 모양만 보여 주는 예시 값으로
    if (NUMERIC_TEMPLATES.includes(template) && !hasDigits(conceptText(concept)) && template === "parts") {
      notes.push(`${term}: 숫자 없는 비율 → ${NUMERIC_FALLBACK.parts}`);
      template = NUMERIC_FALLBACK.parts;
    }
    // 같은 틀 3번 연속이면 뜻이 비슷한 옆 틀로
    const n = concepts.length;
    if (n >= 2 && concepts[n - 1].plan.template === template && concepts[n - 2].plan.template === template && ALT[template]) {
      notes.push(`${term}: ${template} 3연속 → ${ALT[template]}`);
      template = ALT[template]!;
    }
    concepts.push({
      ...concept,
      plan: {
        kind,
        template,
        why: str(p.why),
        focus: str(p.focus),
        motion: str(p.motion),
        cast: Array.isArray(p.cast) ? (p.cast as unknown[]).map((x) => str(x)).filter(Boolean).slice(0, 5) : [],
      },
    });
    if (concepts.length >= count) break;
  }
  return { deckTitle: str(o.deckTitle).trim(), subject: str(o.subject).trim(), concepts, notes };
}

/** 개수 초과는 잘라서 고친다(모자라면 고칠 수 없으니 재생성 사유) */
function clampCounts(v: Visual): Visual {
  const max = (t: VisualTemplate) => LIMITS.count[t][1];
  switch (v.type) {
    case "flow":
      return { ...v, steps: v.steps.slice(0, max("flow")) };
    case "exchange":
      return { ...v, messages: v.messages.slice(0, max("exchange")) };
    case "versus":
      return { ...v, rows: v.rows.slice(0, max("versus")) };
    case "chart": {
      const k = Math.min(v.categories.length, max("chart"));
      return { ...v, categories: v.categories.slice(0, k), series: v.series.slice(0, 2).map((s) => ({ ...s, values: s.values.slice(0, k) })) };
    }
    case "cycle":
      return { ...v, nodes: v.nodes.slice(0, max("cycle")) };
    case "tree":
      return { ...v, children: v.children.slice(0, max("tree")) };
    case "matrix":
      return { ...v, items: v.items.slice(0, max("matrix")) };
    case "formula":
      return { ...v, terms: v.terms.slice(0, max("formula")) };
    case "chain":
      return { ...v, links: v.links.slice(0, max("chain")) };
    case "timeline":
      return { ...v, events: v.events.slice(0, max("timeline")) };
    default:
      return v;
  }
}

export interface BuiltShort {
  short?: TextShort;
  errors: string[];
  warnings: string[];
}

/** 2단계(카드 칸 채우기) 결과 → 검사 → 고치기 → 텍스트 숏츠 */
export function buildShort(c: PlannedConcept, raw: unknown): BuiltShort {
  const template = c.plan.template;
  const r = (raw ?? {}) as Record<string, unknown>;
  // 흔한 실수: visual.type을 빼먹음 → 고른 틀로 채워 준다
  if (r.visual && typeof r.visual === "object" && !(r.visual as Record<string, unknown>).type) (r.visual as Record<string, unknown>).type = template;
  const parsed = cardFillSchema(template).safeParse(r);
  if (!parsed.success) return { errors: parsed.error.issues.slice(0, 6).map((i) => `${i.path.join(".")}: ${i.message}`), warnings: [] };
  const fill = { ...parsed.data, visual: clampCounts(parsed.data.visual as Visual) };
  if (fill.visual.type === "chart" && !hasDigits(conceptText(c))) fill.visual = { ...fill.visual, illustrative: true };
  if (fill.visual.type === "parts" && !hasDigits(conceptText(c))) fill.visual = { ...fill.visual, illustrative: true };
  const errors = validateVisual(template, fill.visual);
  if (errors.length) return { errors, warnings: [] };
  let s = repairShort(toTextShort(c, fill));
  s = { ...s, quiz: shuffleQuiz(s.quiz, s.term) };
  return { short: s, errors: [], warnings: lintShort(s) };
}

/** 카드 묶음의 배경색이 이웃끼리 겹치지 않게 */
export function spreadShortPalettes<T extends { short?: TextShort | null }>(cards: T[]): T[] {
  const ps = spreadPalettes(cards.map((c) => c.short?.palette ?? "blue"));
  return cards.map((c, i) => (c.short ? { ...c, short: { ...c.short, palette: ps[i] } } : c));
}
