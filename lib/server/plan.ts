// 개념별 그림 고르기 (plan): 구조화 출력 스키마와, 브라우저가 보낸 plan을 믿지 않고 다시 다듬는 함수.
// 틀을 바꾸는 규칙(숫자 없는 비율, 3연속)은 디자인 스레드의 lib/assemble.ts checkOutline에 있다.
import { z } from "zod";
import { ConceptSchema, OutlineSchema, type Concept } from "../schema";
import { cleanStr } from "../text";
import { KIND_TO_TEMPLATE, KNOWLEDGE_KINDS, VISUAL_TEMPLATES, VisualPlanSchema, type KnowledgeKind, type VisualPlan, type VisualTemplate } from "../visual";

/** 개념 뽑기 구조화 출력: 개념마다 plan이 붙는다 */
export const DirectorSchema = OutlineSchema.extend({
  concepts: z.array(ConceptSchema.extend({ plan: VisualPlanSchema })),
});

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
