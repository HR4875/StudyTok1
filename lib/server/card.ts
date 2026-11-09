// 2단계(기본): 개념 하나 → 그림 틀 칸 채우기 → 텍스트 숏츠(TextShort).
// 다듬기·검사는 디자인 스레드의 buildShort(lib/assemble.ts)를 그대로 쓰고, 퀴즈가 망가졌는지만 여기서 한 번 더 본다.
// 검사에 걸리면 문제를 알려 주고 같은 틀로 한 번 더, 또 걸리면 대신 틀(수치 틀→단계·분류, 그 밖→비유)로 한 번 더.
// 그래도 안 되면 AI 없이 기본 카드로 대신한다. 모션 보기도 같은 TextShort로 그리므로 AI를 더 부르지 않는다.
import { buildShort, type PlannedConcept } from "../assemble";
import { fallbackScene } from "../fallback";
import { LIMITS } from "../models";
import type { CardResult, RenderMode, SceneRequest, StreamEvent, Usage } from "../schema";
import { cleanStr } from "../text";
import { NUMERIC_FALLBACK, cardFillSchema, type TextShort, type VisualTemplate } from "../visual";
import { AiError, callJson, sumUsage, type Effort } from "./claude";
import { firstEmoji } from "./checks";
import { parsePlan } from "./plan";
import { CARD_SYSTEM, cardUser } from "./prompts";
import TEMPLATES from "./templates.json";

const FATAL = new Set(["NO_KEY", "BAD_KEY", "NO_CREDIT", "BAD_MODEL", "CANCELLED"]);
const WAIT = new Set(["BUSY", "OVERLOADED", "NETWORK", "SERVER"]);
const GUIDES = TEMPLATES as Record<VisualTemplate, { when: string; fill: string; example: unknown }>;

/** 그림 속 이모지 칸은 이모지 하나만 남긴다 */
function tidyEmoji<T>(node: T): T {
  if (Array.isArray(node)) return node.map(tidyEmoji) as T;
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) out[k] = k === "emoji" ? firstEmoji(v) : tidyEmoji(v);
  return out as T;
}

/** 검사 전에 글자를 다듬는다 (제어 문자·공백·길이). 원본은 건드리지 않는다 */
function tidyRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const r = { ...(raw as Record<string, unknown>) };
  if (typeof r.hook === "string") r.hook = cleanStr(r.hook, 60);
  if (r.visual && typeof r.visual === "object") r.visual = tidyEmoji(r.visual);
  const q = r.quiz;
  if (q && typeof q === "object" && !Array.isArray(q)) {
    const qq = q as Record<string, unknown>;
    r.quiz = {
      ...qq,
      question: cleanStr(qq.question, 160),
      options: Array.isArray(qq.options) ? qq.options.map((o) => cleanStr(o, 80)) : qq.options,
      explanation: cleanStr(qq.explanation, 200),
    };
  }
  return r;
}

/** 퀴즈가 풀 수 있는 모양인지: buildShort는 경고만 하므로 여기서 막는다 */
function quizErrors(s: TextShort): string[] {
  const q = s.quiz;
  const errors: string[] = [];
  if (!q.question) errors.push("퀴즈 질문이 비었음");
  if (q.options.length !== 4 || new Set(q.options).size !== 4 || q.options.some((o) => !o)) errors.push("퀴즈 보기는 서로 다른 4개여야 함");
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) errors.push("퀴즈 answer는 0~3");
  return errors;
}

/** AI가 채운 칸 → 텍스트 숏츠. 실패하면 다시 물어볼 때 붙일 문제 목록을 돌려준다 */
export function checkCard(raw: unknown, concept: PlannedConcept): { short: TextShort | null; errors: string[]; warnings: string[] } {
  const b = buildShort(concept, tidyRaw(raw));
  if (!b.short) return { short: null, errors: b.errors, warnings: [] };
  const errors = quizErrors(b.short);
  if (errors.length) return { short: null, errors, warnings: [] };
  return { short: b.short, errors: [], warnings: b.warnings };
}

export function plannedConcept(concept: SceneRequest["concept"]): PlannedConcept {
  return { ...concept, plan: concept.plan ?? parsePlan(null, concept) };
}

export async function runCard(
  req: SceneRequest & { mode: RenderMode; model: string; effort: Effort; prevPalette?: string },
  send: (ev: StreamEvent<unknown>) => void,
  signal: AbortSignal,
  budgetMs: number,
): Promise<{ result: CardResult; usage: Usage }> {
  const until = Date.now() + budgetMs;
  const concept = plannedConcept(req.concept);
  let template: VisualTemplate = concept.plan.template;
  let retryIssues: string[] | undefined;
  const issues: string[] = [];
  let usage: Usage | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    const left = until - Date.now();
    if (left < 10_000) {
      issues.push("시간 부족");
      break;
    }
    if (attempt) send({ type: "status", message: retryIssues ? "검사에 걸린 칸을 고쳐 다시 채우는 중…" : "다른 그림 틀로 다시 만드는 중…" });
    const planned: PlannedConcept = { ...concept, plan: { ...concept.plan, template } };
    try {
      const r = await callJson({
        model: req.model,
        effort: req.effort,
        system: CARD_SYSTEM,
        user: [{ type: "text", text: cardUser({ ...req, concept: planned }, template, GUIDES[template], { prevPalette: req.prevPalette, retryIssues }) }],
        schema: cardFillSchema(template),
        maxTokens: LIMITS.maxOutputTokens.text,
        deadlineMs: left,
        signal,
      });
      usage = sumUsage(usage, r.usage);
      const chk = checkCard(r.raw, planned);
      if (chk.short) {
        issues.push(...chk.warnings);
        return { result: { template, short: chk.short, fallback: false, issues }, usage };
      }
      issues.push(...chk.errors.map((e) => `${template}: ${e}`));
      if (attempt === 0) retryIssues = chk.errors;
      else {
        const next = NUMERIC_FALLBACK[template] ?? "analogy";
        if (next === template) break;
        template = next;
        retryIssues = undefined;
      }
    } catch (e) {
      if (!(e instanceof AiError)) throw e;
      usage = sumUsage(usage, e.usage);
      if (FATAL.has(e.code) || WAIT.has(e.code)) throw e;
      issues.push(e.code);
      if (e.code === "TIMEOUT" || e.code === "REFUSED") break;
    }
  }

  const scene = fallbackScene(req.concept, req.others ?? [], req.index);
  return { result: { template, short: null, fallback: true, issues, scene }, usage: usage ?? sumUsage() };
}
