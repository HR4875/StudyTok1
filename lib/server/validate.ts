// 브라우저가 보낸 요청 본문을 믿지 않고 다시 다듬는다 (크기·개수 제한 포함).
import { DEFAULT_MODEL, LIMITS, findModel } from "../models";
import type { Concept, OutlineRequest, RenderMode, SceneRequest } from "../schema";
import { cleanStr } from "../text";
import { AiError, type Effort } from "./claude";

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const MEDIA = ["image/jpeg", "image/png", "image/webp"] as const;
const EFFORTS: Effort[] = ["low", "medium", "high"];

export function pickModel(v: unknown): string {
  return findModel(typeof v === "string" ? v : undefined)?.id ?? findModel(process.env.AI_MODEL)?.id ?? DEFAULT_MODEL;
}

export function pickMode(v: unknown): RenderMode {
  return v === "motion" ? "motion" : "text";
}

/** 단계별 노력 수준: 환경변수로 바꿀 수 있고 기본은 medium */
export function effortFor(stage: "outline" | RenderMode): Effort {
  const v = process.env[`AI_EFFORT_${stage.toUpperCase()}`] ?? process.env.AI_EFFORT;
  return EFFORTS.includes(v as Effort) ? (v as Effort) : "medium";
}

export function parseOutlineRequest(body: unknown): OutlineRequest & { count: number; model: string; mode: RenderMode } {
  const b = obj(body);
  let budget = LIMITS.maxChars * 1.15; // 공백 포함 여유
  const pages: { n: number; text: string }[] = [];
  for (const v of arr(b.pages).slice(0, LIMITS.maxPages + 10)) {
    const p = obj(v);
    const n = Math.round(Number(p.n));
    const text = typeof p.text === "string" ? p.text.replace(/[^\S\n]+/g, " ").trim() : "";
    if (!Number.isFinite(n) || !text) continue;
    const cut = text.slice(0, Math.max(0, budget));
    budget -= cut.length;
    if (cut) pages.push({ n, text: cut });
    if (budget <= 0) break;
  }
  const images: OutlineRequest["images"] = [];
  for (const v of arr(b.images).slice(0, LIMITS.maxImages)) {
    const im = obj(v);
    const media = MEDIA.find((m) => m === im.media_type);
    const data = typeof im.data === "string" ? im.data : "";
    if (!media || !data || data.length > 2_000_000 || !/^[A-Za-z0-9+/=]+$/.test(data.slice(0, 200))) continue;
    images.push({ n: Math.round(Number(im.n)) || images.length + 1, media_type: media, data });
  }
  if (!pages.length && !images.length) throw new AiError("읽을 글자나 그림이 없어요", "EMPTY", 400);
  const count = Math.min(12, Math.max(3, Math.round(Number(b.count)) || 8));
  return { name: cleanStr(b.name, 120) || "자료", pages, images, count, model: pickModel(b.model), mode: pickMode(b.mode) };
}

function parseConcept(v: unknown): Concept {
  const c = obj(v);
  const concept: Concept = {
    term: cleanStr(c.term, 40),
    definition: cleanStr(c.definition, 160),
    explanation: cleanStr(c.explanation, 900),
    keyPoints: arr(c.keyPoints)
      .map((k) => cleanStr(k, 120))
      .filter(Boolean)
      .slice(0, 5),
    example: cleanStr(c.example, 400),
    visual: cleanStr(c.visual, 400),
    pages: cleanStr(c.pages, 30),
  };
  if (!concept.term || !concept.definition) throw new AiError("개념 정보가 비었어요", "BAD_REQUEST", 400);
  return concept;
}

export function parseSceneRequest(body: unknown): SceneRequest & { mode: RenderMode; model: string } {
  const b = obj(body);
  const d = obj(b.deck);
  const total = Math.min(40, Math.max(1, Math.round(Number(b.total)) || 1));
  return {
    concept: parseConcept(b.concept),
    deck: {
      title: cleanStr(d.title, 80),
      subject: cleanStr(d.subject, 40),
      terms: arr(d.terms)
        .map((t) => cleanStr(t, 40))
        .filter(Boolean)
        .slice(0, 40),
    },
    index: Math.min(total - 1, Math.max(0, Math.round(Number(b.index)) || 0)),
    total,
    mode: pickMode(b.mode),
    model: pickModel(b.model),
    others: arr(b.others)
      .map(obj)
      .map((o) => ({ term: cleanStr(o.term, 40), definition: cleanStr(o.definition, 160) }))
      .filter((o) => o.term && o.definition)
      .slice(0, 40),
  };
}
