// 2단계(기본): 개념 하나 → 그림 틀 칸 채우기(CardFill). 텍스트 숏츠는 이 결과를 코드로 그린다.
// 검사(validateVisual)에 걸리면 문제를 알려 주고 같은 틀로 한 번 더, 또 걸리면 대신 틀(수치 틀→단계·분류, 그 밖→비유)로 한 번 더.
// 그래도 안 되면 AI 없이 기본 카드로 대신한다.
import { fallbackScene, seededRand, shuffleQuiz } from "../fallback";
import { LIMITS } from "../models";
import type { CardResult, RenderMode, SceneRequest, StreamEvent, Usage } from "../schema";
import { cleanStr } from "../text";
import {
  NUMERIC_FALLBACK,
  cardFillSchema,
  lintShort,
  repairShort,
  toTextShort,
  validateVisual,
  type CardFill,
  type Visual,
  type VisualTemplate,
} from "../visual";
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

export function checkFill(raw: unknown, template: VisualTemplate, concept: SceneRequest["concept"]): { fill: CardFill | null; errors: string[]; warnings: string[] } {
  const parsed = cardFillSchema(template).safeParse(raw);
  if (!parsed.success) return { fill: null, errors: parsed.error.issues.slice(0, 6).map((i) => `${i.path.join(".")}: ${i.message}`), warnings: [] };
  const errors = validateVisual(template, parsed.data.visual);
  const q = parsed.data.quiz;
  const options = q.options.map((o) => cleanStr(o, 80));
  if (!cleanStr(q.question)) errors.push("퀴즈 질문이 비었음");
  if (options.length !== 4 || new Set(options).size !== 4 || options.some((o) => !o)) errors.push("퀴즈 보기는 서로 다른 4개여야 함");
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) errors.push("퀴즈 answer는 0~3");
  if (errors.length) return { fill: null, errors, warnings: [] };

  const short = repairShort(
    toTextShort(concept, {
      ...parsed.data,
      hook: cleanStr(parsed.data.hook, 60),
      visual: tidyEmoji(parsed.data.visual) as Visual,
      quiz: { ...q, question: cleanStr(q.question, 160), options, explanation: cleanStr(q.explanation, 200) },
    }),
  );
  const warnings = lintShort(short);
  const fill: CardFill = {
    hook: short.hook,
    highlight: short.highlight,
    palette: short.palette,
    visual: short.visual,
    // 정답이 한 자리에 몰리지 않게, 같은 개념이면 같은 순서로 섞는다
    quiz: shuffleQuiz(short.quiz, seededRand(`${concept.term}|${short.quiz.question}`)),
  };
  return { fill, errors: [], warnings };
}

export async function runCard(
  req: SceneRequest & { mode: RenderMode; model: string; effort: Effort; prevPalette?: string },
  send: (ev: StreamEvent<unknown>) => void,
  signal: AbortSignal,
  budgetMs: number,
): Promise<{ result: CardResult; usage: Usage }> {
  const until = Date.now() + budgetMs;
  const plan = req.concept.plan ?? parsePlan(null, req.concept);
  const concept = { ...req.concept, plan };
  let template: VisualTemplate = plan.template;
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
    try {
      const r = await callJson({
        model: req.model,
        effort: req.effort,
        system: CARD_SYSTEM,
        user: [{ type: "text", text: cardUser({ ...req, concept }, template, GUIDES[template], { prevPalette: req.prevPalette, retryIssues }) }],
        schema: cardFillSchema(template),
        maxTokens: LIMITS.maxOutputTokens.text,
        deadlineMs: left,
        signal,
      });
      usage = sumUsage(usage, r.usage);
      const chk = checkFill(r.raw, template, concept);
      if (chk.fill) {
        issues.push(...chk.warnings);
        return { result: { template, fill: chk.fill, fallback: false, issues }, usage };
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
  return { result: { template, fill: null, fallback: true, issues, scene }, usage: usage ?? sumUsage() };
}
