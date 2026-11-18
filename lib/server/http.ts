// API 라우트 공통: 요청 검사, 하루 한도, NDJSON 스트림 응답
import { checkRateLimit } from "../rateLimit";
import type { StreamEvent } from "../schema";
import { AiError } from "./claude";

export const isMock = () => process.env.MOCK_AI === "1";

export function jsonError(status: number, message: string, code: string): Response {
  return Response.json({ message, code }, { status, headers: { "cache-control": "no-store" } });
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip"))?.trim() || "local";
}

/** 키·한도 검사. 통과하면 null */
export function preflight(req: Request, weight = 1): Response | null {
  if (!process.env.ANTHROPIC_API_KEY && !isMock()) {
    return jsonError(503, "AI 키가 아직 설정되지 않아 지금은 예시 덱만 볼 수 있어요", "NO_KEY");
  }
  const rl = checkRateLimit(clientIp(req), weight);
  if (!rl.ok) return jsonError(429, `오늘 쓸 수 있는 생성 횟수(${rl.limit}회)를 다 썼어요. 내일 다시 해 주세요`, "LIMIT");
  return null;
}

export async function readJson<T>(req: Request, maxBytes: number): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new AiError("자료가 너무 커요. 쪽 범위나 사진 수를 줄여 주세요", "TOO_BIG", 413);
  const text = await req.text();
  if (text.length > maxBytes) throw new AiError("자료가 너무 커요. 쪽 범위나 사진 수를 줄여 주세요", "TOO_BIG", 413);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AiError("요청 형식이 잘못됐어요", "BAD_REQUEST", 400);
  }
}

type Send = (ev: StreamEvent<unknown>) => void;

/** 한 줄에 이벤트 하나씩 흘려보내는 응답. 8초마다 빈 줄을 보내 연결이 끊기지 않게 한다. */
export function ndjson(req: Request, run: (send: Send, signal: AbortSignal) => Promise<void>): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const write = (s: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          closed = true;
        }
      };
      const send: Send = (ev) => write(JSON.stringify(ev) + "\n");
      const beat = setInterval(() => write("\n"), 8000);
      try {
        await run(send, req.signal);
      } catch (e) {
        const err = e instanceof AiError ? e : null;
        if (!err) console.error("[api]", e);
        send({ type: "error", message: err?.message ?? "서버에서 오류가 났어요", code: err?.code ?? "SERVER" });
      } finally {
        clearInterval(beat);
        closed = true;
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
