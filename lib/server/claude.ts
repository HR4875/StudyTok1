// Claude 호출은 이 파일 한 곳에서만 한다. API 키는 서버 환경변수(ANTHROPIC_API_KEY)에만 있다.
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { DEFAULT_EFFORT, MODELS, estimateCost, findModel } from "../models";
import type { Usage } from "../schema";
import { toStrictJsonSchema } from "./jsonSchema";

export type Effort = "low" | "medium" | "high";

export class AiError extends Error {
  code: string;
  status: number;
  usage?: Usage;
  constructor(message: string, code: string, status = 500, usage?: Usage) {
    super(message);
    this.code = code;
    this.status = status;
    this.usage = usage;
  }
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError("AI 키가 아직 설정되지 않았어요", "NO_KEY", 503);
  // 429·529·5xx는 SDK가 2번까지 알아서 다시 시도한다
  client ??= new Anthropic({ maxRetries: 2, timeout: 290_000 });
  return client;
}

export function zeroUsage(): Usage {
  return { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, usd: 0 };
}

export function sumUsage(...list: (Usage | undefined)[]): Usage {
  const t = zeroUsage();
  for (const u of list) {
    if (!u) continue;
    t.calls += u.calls;
    t.input += u.input;
    t.output += u.output;
    t.cacheRead += u.cacheRead;
    t.cacheWrite += u.cacheWrite;
    t.usd += u.usd;
  }
  t.usd = Math.round(t.usd * 1e6) / 1e6;
  return t;
}

function toUsage(model: string, u: Anthropic.Beta.BetaUsage | undefined): Usage {
  const input = u?.input_tokens ?? 0;
  const output = u?.output_tokens ?? 0;
  const cacheRead = u?.cache_read_input_tokens ?? 0;
  const cacheWrite = u?.cache_creation_input_tokens ?? 0;
  return { calls: 1, input, output, cacheRead, cacheWrite, usd: estimateCost(model, { input, output, cacheRead, cacheWrite }) };
}

// 서버측 fallback 베타가 이 조직에서 막혀 있으면(400) 다음부터는 빼고 부른다
let fallbackBetaBlocked = false;

export interface JsonCall {
  model: string;
  effort?: Effort;
  /** 길고 바뀌지 않는 지시문 (캐시됨) */
  system: string;
  user: Anthropic.Beta.BetaContentBlockParam[];
  schema: z.ZodType;
  maxTokens: number;
  deadlineMs: number;
  signal?: AbortSignal;
  /** 답 글자가 나오는 동안 (진행 표시용) */
  onText?: (chars: number) => void;
}

export interface JsonResult {
  raw: unknown;
  usage: Usage;
  model: string;
}

export async function callJson(c: JsonCall): Promise<JsonResult> {
  const m = findModel(c.model) ?? MODELS[0];
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, c.deadlineMs);
  const onAbort = () => ctrl.abort();
  c.signal?.addEventListener("abort", onAbort);

  const attempt = async (withFallback: boolean) => {
    const stream = getClient().beta.messages.stream(
      {
        model: m.id,
        max_tokens: c.maxTokens,
        system: [{ type: "text", text: c.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: c.user }],
        output_config: {
          effort: c.effort ?? DEFAULT_EFFORT,
          format: { type: "json_schema", schema: toStrictJsonSchema(c.schema) },
        },
        ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      },
      { signal: ctrl.signal },
    );
    let chars = 0;
    stream.on("text", (d) => {
      chars += d.length;
      c.onText?.(chars);
    });
    return stream.finalMessage();
  };

  try {
    let msg: Anthropic.Beta.BetaMessage;
    const useFallback = m.serverFallback && !fallbackBetaBlocked;
    try {
      msg = await attempt(useFallback);
    } catch (e) {
      if (useFallback && e instanceof Anthropic.BadRequestError && /beta|fallback/i.test(e.message)) {
        fallbackBetaBlocked = true;
        msg = await attempt(false);
      } else throw e;
    }
    const usage = toUsage(m.id, msg.usage);
    if (msg.stop_reason === "refusal") {
      throw new AiError("이 내용은 AI가 카드로 만들 수 없다고 했어요", "REFUSED", 422, usage);
    }
    const text = msg.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (msg.stop_reason === "max_tokens") throw new AiError("AI 답이 너무 길어 잘렸어요", "BAD_OUTPUT", 502, usage);
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new AiError("AI 답을 읽지 못했어요", "BAD_OUTPUT", 502, usage);
    }
    return { raw, usage, model: msg.model };
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (timedOut) throw new AiError("AI가 너무 오래 걸렸어요", "TIMEOUT", 504);
    if (c.signal?.aborted || e instanceof Anthropic.APIUserAbortError) throw new AiError("취소했어요", "CANCELLED", 499);
    throw mapSdkError(e);
  } finally {
    clearTimeout(timer);
    c.signal?.removeEventListener("abort", onAbort);
  }
}

function mapSdkError(e: unknown): AiError {
  if (e instanceof Anthropic.AuthenticationError) return new AiError("AI 키가 올바르지 않아요. 관리자에게 알려 주세요", "BAD_KEY", 503);
  if (e instanceof Anthropic.PermissionDeniedError) return new AiError("이 AI 키로는 이 모델을 쓸 수 없어요", "BAD_KEY", 503);
  if (e instanceof Anthropic.NotFoundError) return new AiError("AI 모델을 찾지 못했어요", "BAD_MODEL", 503);
  if (e instanceof Anthropic.RateLimitError) return new AiError("지금 요청이 몰렸어요. 잠시 뒤 다시 해 주세요", "BUSY", 429);
  if (e instanceof Anthropic.APIConnectionTimeoutError) return new AiError("AI 응답이 너무 늦어요", "TIMEOUT", 504);
  if (e instanceof Anthropic.APIConnectionError) return new AiError("AI 서버에 연결하지 못했어요", "NETWORK", 502);
  if (e instanceof Anthropic.InternalServerError) return new AiError("AI 서버가 바빠요. 잠시 뒤 다시 해 주세요", "OVERLOADED", 503);
  if (e instanceof Anthropic.APIError) {
    if (e.status === 402) return new AiError("AI 사용 크레딧이 부족해요. 관리자에게 알려 주세요", "NO_CREDIT", 503);
    if (e.status === 413) return new AiError("자료가 너무 커요. 쪽 범위를 줄여 주세요", "TOO_BIG", 413);
    if (e instanceof Anthropic.BadRequestError && /credit|billing/i.test(e.message)) {
      return new AiError("AI 사용 크레딧이 부족해요. 관리자에게 알려 주세요", "NO_CREDIT", 503);
    }
    return new AiError("AI 요청이 거절됐어요", "BAD_REQUEST", 502);
  }
  return new AiError("알 수 없는 오류가 났어요", "SERVER", 500);
}
