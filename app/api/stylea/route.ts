// 스타일A API: 개념 하나 → 모션그래픽 설계도(1~3편) + 암기 퀴즈 + 자료에 실린 문제와 풀이 설계도 (NDJSON 스트림)
import type { StyleAResult } from "@/lib/schema";
import { AiError } from "@/lib/server/claude";
import { isMock, jsonError, ndjson, preflight, readJson } from "@/lib/server/http";
import { mockStyleA } from "@/lib/server/mock";
import { runStyleA } from "@/lib/server/stylea";
import { parseSceneRequest } from "@/lib/server/validate";
import { cleanStr } from "@/lib/text";
import { findModel } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BUDGET_MS = Number(process.env.AI_CARD_BUDGET_MS ?? 170_000);
/** 스타일A 설계도는 Sonnet으로 쓴다(개념당 약 $0.02 기준으로 맞춘 모델). 환경 변수로 바꿀 수 있다 */
const MODEL = findModel(process.env.AI_STYLEA_MODEL)?.id ?? "claude-sonnet-5-5";
const SOURCE_MAX = 6000;

export async function POST(req: Request) {
  const blocked = preflight(req, 1);
  if (blocked) return blocked;
  let body: ReturnType<typeof parseSceneRequest>;
  let source = "";
  try {
    const raw = await readJson<Record<string, unknown>>(req, 200_000);
    body = parseSceneRequest(raw);
    source = typeof raw.source === "string" ? cleanStr(raw.source, SOURCE_MAX) : "";
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("요청을 읽지 못했어요", "BAD_REQUEST", 400);
    return jsonError(err.status, err.message, err.code);
  }

  return ndjson(req, async (send, signal) => {
    if (isMock()) {
      const { result, usage } = await mockStyleA(body);
      send({ type: "done", data: result satisfies StyleAResult, usage });
      return;
    }
    send({ type: "status", message: "모션그래픽 구성하는 중…" });
    const { result, usage } = await runStyleA({ ...body, model: MODEL, effort: "medium", source }, send, signal, BUDGET_MS);
    send({ type: "done", data: result, usage });
  });
}
