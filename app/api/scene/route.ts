// 2단계 API: 개념 하나 → 검사를 통과한 장면 JSON (NDJSON 스트림)
import type { SceneResult } from "@/lib/schema";
import { AiError } from "@/lib/server/claude";
import { isMock, jsonError, ndjson, preflight, readJson } from "@/lib/server/http";
import { mockScene } from "@/lib/server/mock";
import { runScene } from "@/lib/server/scene";
import { effortFor, parseSceneRequest } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** 두 번 시도까지 포함한 한 카드의 시간 예산. 함수 제한(maxDuration)보다 넉넉히 짧게 */
const BUDGET_MS = Number(process.env.AI_SCENE_BUDGET_MS ?? 170_000);

export async function POST(req: Request) {
  const blocked = preflight(req, 1);
  if (blocked) return blocked;
  let body: ReturnType<typeof parseSceneRequest>;
  try {
    body = parseSceneRequest(await readJson(req, 200_000));
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("요청을 읽지 못했어요", "BAD_REQUEST", 400);
    return jsonError(err.status, err.message, err.code);
  }

  return ndjson(req, async (send, signal) => {
    if (isMock()) {
      const { result, usage } = await mockScene(body);
      send({ type: "done", data: result satisfies SceneResult, usage });
      return;
    }
    send({ type: "status", message: body.mode === "motion" ? "모션 설계 중…" : "카드 그리는 중…" });
    const { result, usage } = await runScene({ ...body, effort: effortFor(body.mode) }, send, signal, BUDGET_MS);
    send({ type: "done", data: result, usage });
  });
}
