// MOCK_AI=1 일 때: AI를 부르지 않고 내장 시리즈(lib/film/library.ts)로 답한다. 키 없이 화면 흐름을 시험하는 용도다.
// 계획과 대본은 실제 제작 과정으로 만들어 둔 것이라, 점검과 재생은 실제와 같은 코드를 탄다.
import { BUILT_SERIES } from "../../film/library";
import { briefOf, checkScript, parsePlan, planToText, usablePlan, type SeriesPlan } from "../../film/plan";
import type { FilmPlanRequest, FilmPlanResult, FilmShortResult } from "../../film/types";
import type { StreamEvent } from "../../schema";

type Send = (ev: StreamEvent<unknown>) => void;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const builtPlan = (id: string): SeriesPlan => usablePlan(parsePlan(BUILT_SERIES.find((s) => s.id === id)!.planText));

/** 주제에 맞는 내장 계획을 고른다 (없으면 감가상각) */
const pickSeries = (text: string): string => (/이항|옵션|파생|콜|주가/.test(text) ? "bino" : /신용장|무역|수출|수입/.test(text) ? "lc" : "dep");

export async function mockPlan(req: FilmPlanRequest, send: Send): Promise<FilmPlanResult> {
  const t0 = Date.now();
  const plan = builtPlan(pickSeries(req.topic + " " + req.source.slice(0, 2000)));
  plan.shorts = plan.shorts.slice(0, req.max);
  send({ type: "status", message: "자료를 읽고 가장 쉬운 설명 순서를 고르는 중" });
  await wait(900);
  for (let i = 1; i <= plan.shorts.length; i++) {
    await wait(160);
    send({ type: "found", terms: plan.shorts.slice(0, i).map((s) => s.title) });
  }
  return { planText: planToText(plan), shorts: plan.shorts.length, cut: false, secs: Math.round((Date.now() - t0) / 100) / 10, model: "mock" };
}

export async function mockShort(plan: SeriesPlan, k: number, send: Send): Promise<FilmShortResult> {
  const t0 = Date.now();
  // 같은 시리즈의 같은 편이 내장돼 있으면 그것을, 아니면 내장된 편을 돌려 가며 쓴다 (예시 모드라 내용이 제목과 다를 수 있다)
  const home = BUILT_SERIES.find((s) => parsePlan(s.planText).series === plan.series) ?? BUILT_SERIES[BUILT_SERIES.length - 1];
  const ks = Object.keys(home.shorts).map(Number).sort((a, b) => a - b);
  const pick = home.shorts[k] ?? home.shorts[ks[(k - 1) % ks.length]];
  send({ type: "status", message: "계획한 순서대로 대본을 쓰기 시작하는 중" });
  await wait(500);
  const scenes = (pick.raw.match(/^#\d+/gm) || []).length;
  for (let n = 1; n <= scenes; n += 3) {
    await wait(120);
    send({ type: "status", message: `장면 ${n}개째 쓰는 중` });
  }
  const c = checkScript(pick.raw, home.shorts[k] ? briefOf(plan, k) : null);
  return { raw: c.raw, scenes: c.scenes, dur: Math.round(c.dur * 10) / 10, errs: c.errs.length, calls: 1, fix: "", secs: Math.round((Date.now() - t0) / 100) / 10, model: "mock" };
}
