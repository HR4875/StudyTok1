// 모션 쇼츠 2단계 API: 계획의 k편 → 대본 한 편 (NDJSON 스트림)
// 서버가 대본을 쓰고, 엔진으로 자동 점검하고, 걸린 것이 있으면 한 번만 고친 뒤 최종 대본을 돌려준다.
import { LIMITS } from "@/lib/models";
import type { FilmShortResult } from "@/lib/film/types";
import { AiError } from "@/lib/server/claude";
import { mockShort } from "@/lib/server/film/mock";
import { runShort } from "@/lib/server/film/pipeline";
import { parseShortRequest } from "@/lib/server/film/request";
import { isMock, jsonError, ndjson, preflight, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const blocked = preflight(req, 1);
  if (blocked) return blocked;
  let body: ReturnType<typeof parseShortRequest>;
  try {
    body = parseShortRequest(await readJson(req, LIMITS.maxBodyBytes));
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("요청을 읽지 못했어요", "BAD_REQUEST", 400);
    return jsonError(err.status, err.message, err.code);
  }

  return ndjson(req, async (send, signal) => {
    if (isMock()) {
      send({ type: "done", data: (await mockShort(body.plan, body.k, send)) satisfies FilmShortResult });
      return;
    }
    const { data, usage } = await runShort(body.plan, body.k, send, signal);
    send({ type: "done", data: data satisfies FilmShortResult, usage });
  });
}
