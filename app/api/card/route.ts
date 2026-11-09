// 2단계 API(기본): 개념 하나 → 그림 틀 칸 채우기(CardFill) (NDJSON 스트림)
import type { CardResult } from "@/lib/schema";
import { runCard } from "@/lib/server/card";
import { AiError } from "@/lib/server/claude";
import { isMock, jsonError, ndjson, preflight, readJson } from "@/lib/server/http";
import { mockCard } from "@/lib/server/mock";
import { effortFor, parseSceneRequest } from "@/lib/server/validate";
import { PALETTES } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BUDGET_MS = Number(process.env.AI_CARD_BUDGET_MS ?? 170_000);

export async function POST(req: Request) {
  const blocked = preflight(req, 1);
  if (blocked) return blocked;
  let body: ReturnType<typeof parseSceneRequest>;
  let prevPalette: string | undefined;
  try {
    const raw = await readJson<Record<string, unknown>>(req, 200_000);
    body = parseSceneRequest(raw);
    prevPalette = PALETTES.find((p) => p === raw.prevPalette);
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("요청을 읽지 못했어요", "BAD_REQUEST", 400);
    return jsonError(err.status, err.message, err.code);
  }

  return ndjson(req, async (send, signal) => {
    if (isMock()) {
      const { result, usage } = await mockCard(body);
      send({ type: "done", data: result satisfies CardResult, usage });
      return;
    }
    send({ type: "status", message: "카드 그리는 중…" });
    const { result, usage } = await runCard({ ...body, prevPalette, effort: effortFor("text") }, send, signal, BUDGET_MS);
    send({ type: "done", data: result, usage });
  });
}
