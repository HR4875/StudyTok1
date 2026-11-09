"use client";
// 브라우저 → API 라우트 호출. 라우트는 NDJSON(한 줄에 이벤트 하나)으로 진행 상황을 흘려보낸다.
import type { StreamEvent, Usage } from "./schema";

export interface Health {
  hasKey: boolean;
  mock: boolean;
  model: string;
}

export async function getHealth(): Promise<Health | null> {
  try {
    const r = await fetch("/api/health", { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as Health;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  code: string;
  constructor(message: string, code = "ERROR") {
    super(message);
    this.code = code;
  }
}

/** 다시 시도하면 나아질 수 있는 오류 */
export const RETRYABLE = new Set(["TIMEOUT", "BUSY", "NETWORK", "BAD_OUTPUT", "OVERLOADED"]);

interface StreamOpts {
  signal?: AbortSignal;
  onStatus?: (message: string) => void;
  onFound?: (terms: string[]) => void;
  onDelta?: (chars: number) => void;
}

export async function postStream<T>(url: string, body: unknown, opts: StreamOpts = {}): Promise<{ data: T; usage?: Usage }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new ApiError("취소했어요", "CANCELLED");
    throw new ApiError("인터넷 연결을 확인해 주세요", "NETWORK");
  }
  if (!res.ok || !res.body) {
    // 라우트가 스트림을 열기 전에 막힌 경우 (키 없음, 한도 초과, 너무 큰 요청 등)
    let message = `서버 오류 (${res.status})`;
    let code = res.status === 429 ? "LIMIT" : res.status === 413 ? "TOO_BIG" : res.status >= 500 ? "SERVER" : "ERROR";
    try {
      const j = (await res.json()) as { message?: string; code?: string };
      if (j.message) message = j.message;
      if (j.code) code = j.code;
    } catch {
      if (res.status === 504) {
        message = "시간이 너무 오래 걸렸어요";
        code = "TIMEOUT";
      }
    }
    throw new ApiError(message, code);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let result: { data: T; usage?: Usage } | null = null;
  const handle = (line: string) => {
    if (!line.trim()) return;
    let ev: StreamEvent<T>;
    try {
      ev = JSON.parse(line) as StreamEvent<T>;
    } catch {
      return;
    }
    if (ev.type === "status") opts.onStatus?.(ev.message);
    else if (ev.type === "found") opts.onFound?.(ev.terms);
    else if (ev.type === "delta") opts.onDelta?.(ev.text.length);
    else if (ev.type === "done") result = { data: ev.data, usage: ev.usage };
    else if (ev.type === "error") throw new ApiError(ev.message, ev.code ?? "ERROR");
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        handle(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
      }
    }
    handle(buf);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === "AbortError") throw new ApiError("취소했어요", "CANCELLED");
    // 서버 함수가 시간 제한에 걸려 연결이 끊긴 경우가 대부분
    throw new ApiError("연결이 끊겼어요", "TIMEOUT");
  }
  if (!result) throw new ApiError("응답이 중간에 끊겼어요", "TIMEOUT");
  return result;
}

export function addUsage(a: Usage | undefined, b: Usage | undefined): Usage {
  const z: Usage = { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, usd: 0 };
  const x = a ?? z;
  const y = b ?? z;
  return {
    calls: x.calls + y.calls,
    input: x.input + y.input,
    output: x.output + y.output,
    cacheRead: x.cacheRead + y.cacheRead,
    cacheWrite: x.cacheWrite + y.cacheWrite,
    usd: Math.round((x.usd + y.usd) * 1e6) / 1e6,
  };
}
