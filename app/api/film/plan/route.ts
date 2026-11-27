// 모션 쇼츠 1단계 API: 주제 한 줄이나 자료의 글 → 시리즈 계획 (NDJSON 스트림)
// 계획이 흘러나오는 동안 정해진 편 제목을 found 이벤트로 보낸다.
import { LIMITS } from "@/lib/models";
import type { FilmPlanRequest, FilmPlanResult } from "@/lib/film/types";
import { AiError } from "@/lib/server/claude";
import { mockPlan } from "@/lib/server/film/mock";
import { runPlan } from "@/lib/server/film/pipeline";
import { parsePlanRequest } from "@/lib/server/film/request";
import { isMock, jsonError, ndjson, preflight, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  // 계획은 생각을 켜고 한 번에 길게 쓰는 호출이라 하루 한도에서 3회로 센다
  const blocked = preflight(req, 3);
  if (blocked) return blocked;
  let body: FilmPlanRequest;
  try {
    body = parsePlanRequest(await readJson(req, LIMITS.maxBodyBytes));
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("요청을 읽지 못했어요", "BAD_REQUEST", 400);
    return jsonError(err.status, err.message, err.code);
  }

  return ndjson(req, async (send, signal) => {
    if (isMock()) {
      send({ type: "done", data: (await mockPlan(body, send)) satisfies FilmPlanResult });
      return;
    }
    const { data, usage } = await runPlan(body, send, signal);
    send({ type: "done", data: data satisfies FilmPlanResult, usage });
  });
}
