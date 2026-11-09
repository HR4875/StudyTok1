import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { DEFAULT_EFFORT, LIMITS, estimateCost, findModel } from "@/lib/models";
import { MOTION_ADDENDUM, SYSTEM_PROMPT, TEXT_ADDENDUM, deckSchema, userPrompt } from "@/lib/prompt";
import { checkRateLimit } from "@/lib/rateLimit";
import { sanitizeCards } from "@/lib/sanitize";
import type { GenerateRequest, GenerateResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby 함수 제한

// API 키는 서버 환경변수(ANTHROPIC_API_KEY)에서만 읽는다. 브라우저로 내려가지 않는다.
const client = new Anthropic();

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "서버에 ANTHROPIC_API_KEY 가 설정되지 않았어요. 샘플 덱으로 체험해 보세요." },
      { status: 503 },
    );
  }

  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "요청 형식이 잘못됐어요." }, { status: 400 });
  }

  const model = findModel(body.model);
  if (!model) return NextResponse.json({ error: "지원하지 않는 모델이에요." }, { status: 400 });
  const mode = body.mode === "motion" ? "motion" : "text";

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const pdf = typeof body.pdfBase64 === "string" ? body.pdfBase64 : "";
  if (!text && !pdf) return NextResponse.json({ error: "자료 내용이 비어 있어요." }, { status: 400 });
  if (text.length > LIMITS.maxCharsPerChunk) {
    return NextResponse.json({ error: "한 번에 보내는 글이 너무 길어요." }, { status: 413 });
  }
  if (pdf && (pdf.length * 3) / 4 > LIMITS.maxPdfBytes) {
    return NextResponse.json({ error: "PDF 조각이 너무 커요. 페이지 범위를 줄여 주세요." }, { status: 413 });
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `오늘 생성 한도(${rl.limit}회)를 다 썼어요. 내일 다시 시도하거나 샘플 덱을 보세요.` },
      { status: 429 },
    );
  }

  const prompt = userPrompt({
    docTitle: String(body.docTitle ?? "자료").slice(0, 80),
    pageLabel: String(body.pageLabel ?? "").slice(0, 40),
    chunkIndex: Number(body.chunkIndex) || 0,
    chunkCount: Number(body.chunkCount) || 1,
    text: text || undefined,
  });

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (!text && pdf) {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } });
  }
  content.push({ type: "text", text: prompt });

  const started = Date.now();
  try {
    const stream = client.beta.messages.stream({
      model: model.id,
      max_tokens: LIMITS.maxOutputTokens[mode],
      system: SYSTEM_PROMPT + (mode === "motion" ? MOTION_ADDENDUM : TEXT_ADDENDUM),
      output_config: {
        effort: DEFAULT_EFFORT,
        format: { type: "json_schema", schema: deckSchema(mode) },
      },
      messages: [{ role: "user", content }],
      ...(model.serverFallback
        ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
        : {}),
    });
    const msg = await stream.finalMessage();

    if (msg.stop_reason === "refusal") {
      return NextResponse.json({ error: "AI가 이 자료로는 카드를 만들 수 없다고 했어요." }, { status: 422 });
    }
    if (msg.stop_reason === "max_tokens") {
      return NextResponse.json({ error: "답이 너무 길어져 잘렸어요. 페이지 범위를 줄여 주세요." }, { status: 422 });
    }

    const raw = msg.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const parsed = JSON.parse(raw) as { title: string; cards: unknown[] };
    const cards = sanitizeCards(parsed.cards, mode, Number(body.chunkIndex) || 0);

    const result: GenerateResponse = {
      title: String(parsed.title ?? ""),
      cards,
      usage: {
        model: model.id,
        servedBy: msg.model,
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
        costUsd: estimateCost(msg.model, msg.usage.input_tokens, msg.usage.output_tokens),
        ms: Date.now() - started,
      },
    };
    return NextResponse.json(result, { headers: { "x-ratelimit-remaining": String(rl.remaining) } });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "AI 응답을 읽지 못했어요. 다시 시도해 주세요." }, { status: 502 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "AI 서버가 바빠요. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error", err.status, err.message);
      return NextResponse.json({ error: `AI 호출 오류 (${err.status ?? "network"})` }, { status: 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "알 수 없는 오류가 났어요." }, { status: 500 });
  }
}
