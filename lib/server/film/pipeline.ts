// 모션 쇼츠 제작: 생각은 한 번, 연출은 싸게.
//   1) 계획 (단원에 한 번, 생각 켬): 한 단원을 여러 편으로 나누고 편마다 가장 쉬운 길과 단계를 정한다.
//   2) 대본 (편마다, 생각 끔): 계획한 단계를 장면 표기로 옮긴다. 지시문은 캐시된다.
//   3) 자동 점검: 엔진이 대본을 코드로 검사한다 (모델을 부르지 않는다).
//   4) 수리는 한 번만: 한 장면 안에서 끝나는 오류면 그 장면만, 아니면 전체를 다시 쓴다. 나아졌을 때만 받아들인다.
// 모델은 Sonnet 5.5로 고정한다 (이 가격과 속도에 맞춰 지시문을 다듬었고, 더 작은 모델은 설명의 질이 떨어졌다).
import {
  briefOf,
  checkScript,
  cleanPatch,
  cleanPlan,
  cleanRaw,
  isLocal,
  parsePlan,
  patchUser,
  planToText,
  rewriteUser,
  usablePlan,
  type Checked,
  type SeriesPlan,
} from "../../film/plan";
import { applyPatch, toText } from "../../film/script";
import { FILM_LIMITS, type FilmPlanRequest, type FilmPlanResult, type FilmShortResult } from "../../film/types";
import type { StreamEvent, Usage } from "../../schema";
import { AiError, callText, sumUsage } from "../claude";
import { PLANNER_PROMPT, WRITER_PROMPT } from "./prompts";

export const FILM_MODEL = "claude-sonnet-5-5";

type Send = (ev: StreamEvent<unknown>) => void;
const secsSince = (t0: number) => Math.round((Date.now() - t0) / 100) / 10;

/** 계획이 흘러나오는 동안 지금까지 정해진 편 제목 */
export const titlesIn = (text: string): string[] => (text.match(/^SHORT\s+\d+\s*\|\s*[^|\n]+/gm) || []).map((l) => l.replace(/^SHORT\s+\d+\s*\|\s*/, "").trim());

export async function runPlan(req: FilmPlanRequest, send: Send, signal: AbortSignal): Promise<{ data: FilmPlanResult; usage: Usage }> {
  const t0 = Date.now();
  let user = req.topic ? `주제: ${req.topic}\n` : "";
  user += req.source ? `\n학생이 올린 자료입니다.\n<자료>\n${req.source}\n</자료>\n` : "\n자료는 없습니다. 이 주제를 처음 배우는 대학생을 위해 계획하세요.\n";
  user += `\n이번에는 자료의 앞부분부터 차례로 최대 ${req.max}편까지만 계획하세요. 한 편의 밀도는 그대로 한 편에 한 가지 생각이고, ${req.max}편에 다 담지 못한 뒤쪽 내용은 계획하지 않습니다.\n`;

  send({ type: "status", message: "자료를 읽고 교재 순서대로 개념을 나누는 중" });
  let shown = 0;
  const r = await callText({
    model: FILM_MODEL,
    effort: "medium",
    system: PLANNER_PROMPT,
    user,
    think: true,
    maxTokens: 40000,
    deadlineMs: 270_000,
    signal,
    onText: (text) => {
      const titles = titlesIn(text);
      if (titles.length === shown) return;
      shown = titles.length;
      send({ type: "found", terms: titles });
    },
  });

  const all = parsePlan(cleanPlan(r.text));
  const plan = usablePlan(all);
  plan.shorts = plan.shorts.slice(0, req.max);
  if (!plan.series || !plan.shorts.length) throw new AiError("계획을 끝까지 받지 못했어요. 자료를 조금 줄이거나 다시 눌러 주세요", "BAD_OUTPUT", 502, r.usage);
  return {
    data: { planText: planToText(plan), shorts: plan.shorts.length, cut: r.truncated || plan.shorts.length < Math.min(all.shorts.length, req.max), secs: secsSince(t0), model: r.model },
    usage: r.usage,
  };
}

export async function runShort(plan: SeriesPlan, k: number, send: Send, signal: AbortSignal): Promise<{ data: FilmShortResult; usage: Usage }> {
  const t0 = Date.now();
  const brief = briefOf(plan, k);
  const MIN = FILM_LIMITS.minScenes;
  const errors = (c: Checked) => c.errs.length;

  /** 대본이 흘러나오는 동안 몇 번째 장면을 쓰는지 알린다 */
  const counter = () => {
    let shown = 0;
    return (text: string) => {
      const n = (text.match(/^#\d+/gm) || []).length;
      if (n === shown) return;
      shown = n;
      send({ type: "status", message: `장면 ${n}개째 쓰는 중` });
    };
  };
  const write = (user: string, maxTokens: number, onText?: (text: string) => void) =>
    callText({ model: FILM_MODEL, effort: "medium", system: WRITER_PROMPT, user, think: false, maxTokens, deadlineMs: 110_000, signal, onText });

  send({ type: "status", message: "계획한 순서대로 대본을 쓰기 시작하는 중" });
  const r1 = await write(brief.user, 8000, counter());
  const raw1 = cleanRaw(r1.text);
  let best = checkScript(raw1, brief);
  let usage = r1.usage;
  let calls = 1;
  let fix: FilmShortResult["fix"] = "";
  let model = r1.model;

  try {
    if (best.scenes >= MIN && isLocal(best.errs)) {
      send({ type: "status", message: "자동 점검에서 걸린 장면만 고치는 중" });
      const r2 = await write(patchUser(brief.user, best.script, best.errs, raw1), 4000);
      usage = sumUsage(usage, r2.usage);
      calls = 2;
      const merged = applyPatch(best.script, cleanPatch(r2.text));
      const c2 = checkScript(toText(merged.script), brief);
      const bad2 = errors(c2) + merged.issues.filter((i) => i.level === "error").length;
      if (merged.changed.length && c2.scenes >= MIN && bad2 < errors(best)) {
        best = c2;
        fix = "patch";
        model = r2.model;
      }
    } else if (errors(best) || best.scenes < MIN) {
      send({ type: "status", message: "자동 점검에서 걸린 곳을 고쳐 다시 쓰는 중" });
      const r2 = await write(rewriteUser(brief.user, raw1, best.errs), 8000, counter());
      usage = sumUsage(usage, r2.usage);
      calls = 2;
      const c2 = checkScript(cleanRaw(r2.text), brief);
      if (c2.scenes >= MIN && (best.scenes < MIN || errors(c2) <= errors(best))) {
        best = c2;
        fix = "rewrite";
        model = r2.model;
      }
    }
  } catch (e) {
    // 수리가 실패해도 볼 수 있는 첫 대본이 있으면 그것을 돌려준다. 취소는 그대로 올린다.
    if (!(e instanceof AiError) || e.code === "CANCELLED" || best.scenes < MIN) throw e;
  }

  if (best.scenes < 2) throw new AiError("받은 대본을 읽지 못했어요. 다시 눌러 주세요", "BAD_OUTPUT", 502, usage);
  return {
    data: { raw: best.raw, scenes: best.scenes, dur: Math.round(best.dur * 10) / 10, errs: errors(best), calls, fix, secs: secsSince(t0), model },
    usage,
  };
}
