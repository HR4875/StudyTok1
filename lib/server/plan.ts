// 개념별 그림 고르기 (plan) 다듬기: AI 판단 뒤에 코드 규칙으로 한 번 더 거른다 (AI 호출 없음).
// 규칙은 디자인 스레드 계약(lib/visual.ts, visual-pipeline/README.md)을 따른다.
import { z } from "zod";
import { ConceptSchema, OutlineSchema, type Concept } from "../schema";
import { cleanStr } from "../text";
import {
  KIND_TO_TEMPLATE,
  KNOWLEDGE_KINDS,
  NUMERIC_FALLBACK,
  NUMERIC_TEMPLATES,
  VISUAL_TEMPLATES,
  VisualPlanSchema,
  type KnowledgeKind,
  type VisualPlan,
  type VisualTemplate,
} from "../visual";

/** 개념 뽑기 구조화 출력: 개념마다 plan이 붙는다 */
export const DirectorSchema = OutlineSchema.extend({
  concepts: z.array(ConceptSchema.extend({ plan: VisualPlanSchema })),
});

/** 같은 틀이 세 번 이어질 때 셋째에 쓸 다음 후보 */
export const SECOND_CHOICE: Record<VisualTemplate, VisualTemplate> = {
  flow: "chain",
  exchange: "flow",
  versus: "matrix",
  chart: "versus",
  cycle: "flow",
  tree: "versus",
  matrix: "versus",
  formula: "chain",
  chain: "flow",
  parts: "tree",
  timeline: "flow",
  analogy: "versus",
};

const SHAPE_WORDS = /추세|곡선|증가|감소|정점|오르|내리|늘|줄|변화|커지|작아지|상승|하락|흐름/;

export function parsePlan(raw: unknown, concept: Pick<Concept, "keyPoints" | "term">): VisualPlan {
  const p = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const kind: KnowledgeKind = KNOWLEDGE_KINDS.includes(p.kind as KnowledgeKind) ? (p.kind as KnowledgeKind) : concept.keyPoints.length >= 3 ? "process" : "abstract";
  const template: VisualTemplate = VISUAL_TEMPLATES.includes(p.template as VisualTemplate) ? (p.template as VisualTemplate) : KIND_TO_TEMPLATE[kind];
  const cast = (Array.isArray(p.cast) ? p.cast : [])
    .map((c) => cleanStr(c, 16))
    .filter(Boolean)
    .slice(0, 5);
  return {
    kind,
    template,
    why: cleanStr(p.why, 80),
    focus: cleanStr(p.focus, 60),
    motion: cleanStr(p.motion, 80),
    cast,
  };
}

const hasNumber = (c: Concept) => /\d/.test([c.explanation, c.example, ...c.keyPoints].join(" "));

/**
 * 1) 수치 틀(chart·parts)인데 원문에 숫자가 없으면: 모양(추세)이 핵심이면 두고, 아니면 대신 틀로
 * 2) 같은 틀 3연속이면 셋째를 다음 후보로
 * 3) cast는 5개까지
 */
export function applyPlanRules(concepts: Concept[]): { concepts: Concept[]; notes: string[] } {
  const notes: string[] = [];
  const out = concepts.map((c) => ({ ...c, plan: c.plan ? { ...c.plan, cast: c.plan.cast.slice(0, 5) } : parsePlan(null, c) }));
  for (const c of out) {
    const p = c.plan!;
    if (NUMERIC_TEMPLATES.includes(p.template) && !hasNumber(c)) {
      const shape = p.template === "chart" && SHAPE_WORDS.test(`${p.focus} ${p.motion} ${p.why}`);
      if (!shape) {
        const to = NUMERIC_FALLBACK[p.template] ?? "flow";
        notes.push(`${c.term}: 원문에 숫자가 없어 ${p.template} → ${to}`);
        p.template = to;
      }
    }
  }
  for (let i = 2; i < out.length; i++) {
    const [a, b, c] = [out[i - 2].plan!, out[i - 1].plan!, out[i].plan!];
    if (a.template === b.template && b.template === c.template) {
      const to = SECOND_CHOICE[c.template];
      notes.push(`${out[i].term}: ${c.template} 3연속이라 ${to}로`);
      c.template = to;
    }
  }
  return { concepts: out, notes };
}
