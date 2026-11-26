// 모션 쇼츠 API의 요청 본문을 믿지 않고 다시 다듬는다 (크기·개수 제한 포함).
import { parsePlan, usablePlan, type SeriesPlan } from "../../film/plan";
import { FILM_LIMITS, type FilmPlanRequest } from "../../film/types";
import { cleanStr } from "../../text";
import { AiError } from "../claude";

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
/** 줄바꿈과 탭만 남기고 나머지 제어 문자는 뺀다 */
const plain = (v: unknown, max: number): string =>
  typeof v === "string"
    ? v
        .replace(/\r/g, "")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "")
        .slice(0, max)
    : "";

export function parsePlanRequest(body: unknown): FilmPlanRequest {
  const b = obj(body);
  const topic = cleanStr(b.topic, FILM_LIMITS.topicChars);
  const source = plain(b.source, FILM_LIMITS.sourceChars).trim();
  const letters = source.replace(/\s/g, "").length;
  if (!topic && letters < 200) throw new AiError("주제를 쓰거나, 글자가 200자 넘는 자료를 넣어 주세요", "EMPTY", 400);
  const max = Math.min(FILM_LIMITS.planMax, Math.max(1, Math.round(Number(b.max)) || FILM_LIMITS.planDefault));
  return { topic, source: letters >= 40 ? source : "", max };
}

export function parseShortRequest(body: unknown): { plan: SeriesPlan; k: number } {
  const b = obj(body);
  const planText = plain(b.planText, FILM_LIMITS.planChars);
  const plan = usablePlan(parsePlan(planText));
  if (!plan.series || !plan.shorts.length) throw new AiError("시리즈 계획을 읽지 못했어요", "BAD_REQUEST", 400);
  const k = Math.round(Number(b.k));
  if (!Number.isFinite(k) || k < 1 || k > plan.shorts.length) throw new AiError("없는 편이에요", "BAD_REQUEST", 400);
  return { plan, k };
}
