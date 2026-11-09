// 1단계 API: 고른 쪽의 글자·그림 → 핵심 개념 목록 (NDJSON 스트림)
import { LIMITS } from "@/lib/models";
import type { Outline } from "@/lib/schema";
import { AiError } from "@/lib/server/claude";
import { isMock, jsonError, ndjson, preflight, readJson } from "@/lib/server/http";
import { mockOutline } from "@/lib/server/mock";
import { runOutline } from "@/lib/server/outline";
import { effortFor, parseOutlineRequest } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const blocked = preflight(req, 1);
  if (blocked) return blocked;
  let body: ReturnType<typeof parseOutlineRequest>;
  try {
    body = parseOutlineRequest(await readJson(req, LIMITS.maxBodyBytes));
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("요청을 읽지 못했어요", "BAD_REQUEST", 400);
    return jsonError(err.status, err.message, err.code);
  }

  return ndjson(req, async (send, signal) => {
    if (isMock()) {
      const outline = await mockOutline(body, (terms, templates) => send({ type: "found", terms, templates }));
      send({ type: "done", data: outline });
      return;
    }
    const { outline, usage } = await runOutline({ ...body, effort: effortFor("outline") }, send, signal);
    send({ type: "done", data: outline satisfies Outline, usage });
  });
}
