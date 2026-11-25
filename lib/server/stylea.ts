// 스타일A 생성: 개념 하나 → 모션그래픽 설계도 1~3편 + 암기 퀴즈 + (자료에 실린) 교재 문제와 풀이 설계도.
// 한 번 부르고, 검사에 걸리면 무엇이 틀렸는지 붙여 한 번만 다시 받는다. 그래도 안 되면 기본 카드로 대신한다.
import { z } from "zod";
import { fallbackScene } from "../fallback";
import { QuizSchema, type ExamProblem, type Quiz, type SceneRequest, type StreamEvent, type StyleAResult, type StyleASpec, type Usage } from "../schema";
import { checkSpec, parseSpec } from "../stylea";
import { cleanStr } from "../text";
import { AiError, callJson, sumUsage, type Effort } from "./claude";
import { STYLEA_GUIDE } from "./styleaGuide";

const FATAL = new Set(["NO_KEY", "BAD_KEY", "NO_CREDIT", "BAD_MODEL", "CANCELLED"]);
const WAIT = new Set(["BUSY", "OVERLOADED", "NETWORK", "SERVER"]);
const ARCS = ["A", "B", "C", "D", "E"];
export const MAX_PROBLEMS = 3;

const OutSchema = z.object({
  parts: z.array(z.string()).describe("개념 영상 설계도 1~3개. 각 원소는 가이드의 출력 형식을 따른 JSON 문자열 하나"),
  quiz: QuizSchema,
  problems: z.array(
    z.object({
      text: z.string().describe("문제 본문. 자료에 실린 그대로"),
      given: z.array(z.string()).describe("주어진 값 (최대 6개, 없으면 빈 배열)"),
      ask: z.string().describe("구할 것 (10자 이내, 없으면 '')"),
      options: z.array(z.string()).describe("객관식이면 보기 전부, 주관식이면 빈 배열"),
      answerIndex: z.number().int().describe("객관식 정답 번호(0부터). 주관식이면 -1"),
      answer: z.string().describe("정답 (객관식이면 정답 보기 글)"),
      source: z.string().describe("자료에서의 위치. 예: '예제 2', 'p.14 연습문제 3'"),
      explanation: z.string().describe("글 해설 2~3문장"),
      solution: z.string().describe("풀이 영상 설계도(종류: 풀이) JSON 문자열 하나"),
    }),
  ),
});

const SYSTEM = `${STYLEA_GUIDE}

# 이 요청에서 내야 하는 것

위 가이드는 설계도 하나를 쓰는 법이다. 이 요청에서는 개념 하나에 대해 아래 세 가지를 한 번에 낸다. 답은 지정된 JSON 틀로만 낸다.

## 1. parts: 개념 영상 설계도 (각각 JSON 문자열)
- 쉬운 개념은 1편. 식이나 계산 절차가 있어 한 편에 담기 벅찬 개념만 2~3편으로 나눈다.
- 나눌 때는 편마다 한 가지만 다룬다(예: 1편 무엇이 문제인가, 2편 어떻게 재는가). 모든 편이 **같은 예시 값과 같은 그림(type)** 을 이어 쓴다.
- 각 편은 hook으로 시작해 end로 끝난다. 나눈 편에는 series를 넣지 않아도 된다(서버가 붙인다). title은 편마다 다르게 쓴다.

## 2. quiz: 암기용 퀴즈 1개
- 영상에서 보여준 핵심을 묻는 쉬운 4지선다. 보기 4개는 서로 달라야 하고 answer는 0~3.

## 3. problems: 자료에 실린 문제
- 아래 "자료 원문"에 이 개념의 **예제, 연습문제, 계산 문제가 실제로 실려 있을 때만** 옮긴다. 최대 ${MAX_PROBLEMS}개. 없으면 빈 배열.
- 문제를 지어내지 않는다. 숫자와 문장은 자료의 것을 그대로 쓴다.
- solution은 "종류: 풀이" 설계도다(problem → table 또는 움직임 장면 → solve → end). 계산은 반드시 검산한다. 자료에 정답이 없으면 직접 풀어 answer를 채운다.`;

function userText(req: SceneRequest & { source?: string }, retry?: { issues: string[]; previous: string }): string {
  const c = req.concept;
  const arc = ARCS[(req.index + c.term.length) % ARCS.length];
  const lines = [
    `과목: ${req.deck.subject || "미정"} / 자료: ${req.deck.title}`,
    `개념: ${c.term}`,
    `정의: ${c.definition}`,
    c.explanation ? `설명: ${c.explanation}` : "",
    c.keyPoints.length ? `시험 포인트: ${c.keyPoints.join(" / ")}` : "",
    c.example ? `예시: ${c.example}` : "",
    `구성: ${arc} (1편일 때. 나눈 편은 내용에 맞게 고른다)`,
    "",
    req.source ? `자료 원문 (${c.pages || "해당 쪽"}):\n"""\n${req.source}\n"""` : "자료 원문: 없음 (problems는 빈 배열)",
  ];
  if (retry) lines.push("", "앞서 낸 답이 검사에 걸렸다. 아래 문제만 고쳐 전체를 다시 낸다.", ...retry.issues.map((i) => `- ${i}`), "", `앞서 낸 답: ${retry.previous}`);
  return lines.filter((l, i) => l || lines[i - 1]).join("\n");
}

function checkQuiz(q: Quiz): string[] {
  const errors: string[] = [];
  if (!q.question) errors.push("quiz: 질문이 비었음");
  if (q.options.length !== 4 || new Set(q.options).size !== 4 || q.options.some((o) => !o)) errors.push("quiz: 보기는 서로 다른 4개여야 함");
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) errors.push("quiz: answer는 0~3");
  return errors;
}

/** AI 답 → 결과. errors가 있으면 다시 받아야 한다. 문제 쪽 흠은 그 문제만 버린다(warnings) */
export function checkStyleA(raw: unknown, term: string): { result: Omit<StyleAResult, "fallback" | "issues"> | null; errors: string[]; warnings: string[] } {
  const parsed = OutSchema.safeParse(raw);
  if (!parsed.success) return { result: null, errors: ["답의 틀이 맞지 않음"], warnings: [] };
  const errors: string[] = [];
  const warnings: string[] = [];
  const parts: StyleASpec[] = [];
  parsed.data.parts.slice(0, 3).forEach((p, i) => {
    const spec = parseSpec(p);
    if (!spec) return errors.push(`parts[${i}]: JSON으로 읽을 수 없음`);
    const e = checkSpec(spec, "concept");
    if (e.length) errors.push(...e.map((x) => `parts[${i}]: ${x}`));
    else parts.push(spec);
  });
  if (!parsed.data.parts.length) errors.push("parts가 비었음");
  const quiz: Quiz = {
    question: cleanStr(parsed.data.quiz.question, 160),
    options: parsed.data.quiz.options.map((o) => cleanStr(o, 80)),
    answer: parsed.data.quiz.answer,
    explanation: cleanStr(parsed.data.quiz.explanation, 200),
  };
  errors.push(...checkQuiz(quiz));
  if (errors.length) return { result: null, errors, warnings };
  // 여러 편이면 편 표시를 서버가 붙인다
  if (parts.length > 1) {
    parts.forEach((s, i) => {
      const next = parts[i + 1];
      s.series = { name: term, index: i + 1, total: parts.length, ...(next?.title ? { next: cleanStr(String(next.title).replace(term, "").trim() || next.title, 14) } : {}) };
    });
  } else delete parts[0].series;

  const problems: Omit<ExamProblem, "id">[] = [];
  parsed.data.problems.slice(0, MAX_PROBLEMS).forEach((p, i) => {
    const text = cleanStr(p.text, 600);
    const answer = cleanStr(p.answer, 120);
    if (!text || !answer) return warnings.push(`problems[${i}]: 본문이나 정답이 비어 뺌`);
    const options = p.options.map((o) => cleanStr(o, 100)).filter(Boolean);
    const choice = options.length >= 2 && p.answerIndex >= 0 && p.answerIndex < options.length;
    const sol = parseSpec(p.solution);
    const solErr = sol ? checkSpec(sol, "solution") : ["JSON으로 읽을 수 없음"];
    if (solErr.length) warnings.push(`problems[${i}]: 풀이 영상 없이 넣음 (${solErr[0]})`);
    if (sol) delete sol.series;
    problems.push({
      concept: term,
      text,
      given: p.given.map((g) => cleanStr(g, 24)).filter(Boolean).slice(0, 6),
      ask: cleanStr(p.ask, 20) || undefined,
      ...(choice ? { options, answerIndex: p.answerIndex } : {}),
      answer,
      source: cleanStr(p.source, 30) || undefined,
      explanation: cleanStr(p.explanation, 400) || undefined,
      solution: solErr.length ? null : sol,
    });
  });
  return { result: { parts, quiz, problems }, errors: [], warnings };
}

export async function runStyleA(
  req: SceneRequest & { model: string; effort: Effort; source?: string },
  send: (ev: StreamEvent<unknown>) => void,
  signal: AbortSignal,
  budgetMs: number,
): Promise<{ result: StyleAResult; usage: Usage }> {
  const until = Date.now() + budgetMs;
  let retry: { issues: string[]; previous: string } | undefined;
  const issues: string[] = [];
  let usage: Usage | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const left = until - Date.now();
    if (left < 15_000) {
      issues.push("시간 부족");
      break;
    }
    if (attempt) send({ type: "status", message: "검사에 걸린 장면을 고쳐 다시 만드는 중…" });
    try {
      const r = await callJson({
        model: req.model,
        effort: req.effort,
        system: SYSTEM,
        user: [{ type: "text", text: userText(req, retry) }],
        schema: OutSchema,
        maxTokens: 12000,
        deadlineMs: left,
        signal,
      });
      usage = sumUsage(usage, r.usage);
      const chk = checkStyleA(r.raw, req.concept.term);
      if (chk.result) return { result: { ...chk.result, fallback: false, issues: [...issues, ...chk.warnings] }, usage };
      issues.push(...chk.errors);
      retry = { issues: chk.errors, previous: JSON.stringify(r.raw).slice(0, 12000) };
    } catch (e) {
      if (!(e instanceof AiError)) throw e;
      usage = sumUsage(usage, e.usage);
      if (FATAL.has(e.code) || WAIT.has(e.code)) throw e;
      issues.push(e.code);
      if (e.code === "TIMEOUT" || e.code === "REFUSED") break;
      retry = undefined;
    }
  }
  const scene = fallbackScene(req.concept, req.others ?? [], req.index);
  return { result: { parts: [], quiz: scene.quiz, problems: [], fallback: true, issues, scene }, usage: usage ?? sumUsage() };
}
