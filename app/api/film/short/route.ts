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

/** 미리 만드는 요청이 남겨 두는 몫: 하루 한도의 마지막 5분의 1은 사람이 직접 누른 만들기에만 쓴다 */
const AHEAD_SPARE = 0.2;

export async function POST(req: Request) {
  // 키가 없으면 본문을 읽기 전에 돌려보낸다 (횟수는 아직 세지 않는다: 미리 만드는 요청인지는 본문에 있다)
  const noKey = preflight(req, 0);
  if (noKey) return noKey;
  let body: ReturnType<typeof parseShortRequest>;
  try {
    body = parseShortRequest(await readJson(req, LIMITS.maxBodyBytes));
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("요청을 읽지 못했어요", "BAD_REQUEST", 400);
    return jsonError(err.status, err.message, err.code);
  }
  const blocked = preflight(req, 1, body.ahead ? AHEAD_SPARE : 0);
  if (blocked) return blocked;

  return ndjson(req, async (send, signal) => {
    if (isMock()) {
      send({ type: "done", data: (await mockShort(body.plan, body.k, send)) satisfies FilmShortResult });
      return;
    }
    const { data, usage } = await runShort(body.plan, body.k, send, signal);
    send({ type: "done", data: data satisfies FilmShortResult, usage });
  });
}
