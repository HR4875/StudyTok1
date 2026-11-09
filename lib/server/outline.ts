// 1단계: 개념 뽑기. 긴 자료는 쪽 순서대로 최대 4조각으로 나눠 동시에 부르고, 결과를 합친다.
import type Anthropic from "@anthropic-ai/sdk";
import { LIMITS } from "../models";
import type { Concept, Outline, OutlineRequest, StreamEvent, Usage } from "../schema";
import { AiError, callJson, sumUsage, type Effort } from "./claude";
import { checkConcepts, mergeConcepts } from "./checks";
import { applyPlanRules, DirectorSchema } from "./plan";
import { OUTLINE_SYSTEM, outlineUser } from "./prompts";

type Img = OutlineRequest["images"][number];
interface Chunk {
  pages: { n: number; text: string }[];
  images: Img[];
  weight: number;
  quota: number;
}

const IMG_WEIGHT = 1500; // 그림 한 장 ≈ 글자 1500자 분량으로 친다

function label(ch: Chunk, photos: boolean): string {
  const ns = [...ch.pages.map((p) => p.n), ...ch.images.map((i) => i.n)].sort((a, b) => a - b);
  if (!ns.length) return "";
  if (photos) return ns.length === 1 ? `사진 ${ns[0]}` : `사진 ${ns[0]}-${ns[ns.length - 1]}`;
  return ns.length === 1 ? `p.${ns[0]}` : `p.${ns[0]}-${ns[ns.length - 1]}`;
}

/** 쪽 순서를 지키며 비슷한 무게로 나눈다 */
export function splitChunks(req: { pages: { n: number; text: string }[]; images: Img[] }, count: number): Chunk[] {
  const items = [
    ...req.pages.map((p) => ({ n: p.n, page: p, img: null as Img | null, w: p.text.length })),
    ...req.images.map((i) => ({ n: i.n, page: null, img: i, w: IMG_WEIGHT })),
  ].sort((a, b) => a.n - b.n);
  const total = items.reduce((s, it) => s + it.w, 0);
  const pieces = Math.max(1, Math.min(LIMITS.outlineChunks, Math.ceil(total / LIMITS.chunkChars), count, items.length));
  const target = total / pieces;
  const chunks: Chunk[] = [];
  let cur: Chunk = { pages: [], images: [], weight: 0, quota: 0 };
  for (const it of items) {
    if (cur.weight > 0 && cur.weight + it.w / 2 > target && chunks.length < pieces - 1) {
      chunks.push(cur);
      cur = { pages: [], images: [], weight: 0, quota: 0 };
    }
    if (it.page) cur.pages.push(it.page);
    if (it.img) cur.images.push(it.img);
    cur.weight += it.w;
  }
  if (cur.weight > 0) chunks.push(cur);

  // 개수 배분: 무게에 비례, 조각마다 최소 1개, 합은 count
  let left = count;
  chunks.forEach((c, i) => {
    const share = i === chunks.length - 1 ? left : Math.max(1, Math.round((count * c.weight) / Math.max(1, total)));
    c.quota = Math.max(1, Math.min(share, left - (chunks.length - 1 - i)));
    left -= c.quota;
  });
  return chunks;
}

function chunkContent(ch: Chunk, req: OutlineRequest, photos: boolean): Anthropic.Beta.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  const items = [
    ...ch.pages.map((p) => ({ n: p.n, text: p.text, img: null as Img | null })),
    ...ch.images.map((i) => ({ n: i.n, text: "", img: i })),
  ].sort((a, b) => a.n - b.n);
  let buf = "";
  const flush = () => {
    if (buf.trim()) blocks.push({ type: "text", text: buf.trim() });
    buf = "";
  };
  for (const it of items) {
    if (it.img) {
      flush();
      blocks.push({ type: "text", text: photos ? `[사진 ${it.n}]` : `[p.${it.n}] (그림으로 된 쪽)` });
      blocks.push({ type: "image", source: { type: "base64", media_type: it.img.media_type, data: it.img.data } });
    } else buf += `[p.${it.n}]\n${it.text}\n\n`;
  }
  flush();
  blocks.push({ type: "text", text: outlineUser({ name: req.name, quota: ch.quota, pageLabel: label(ch, photos), hasImages: ch.images.length > 0 }) });
  return blocks;
}

export async function runOutline(
  req: OutlineRequest & { model: string; effort: Effort; count: number },
  send: (ev: StreamEvent<unknown>) => void,
  signal: AbortSignal,
): Promise<{ outline: Outline; usage: Usage }> {
  const photos = req.pages.length === 0;
  const chunks = splitChunks(req, req.count);
  send({ type: "status", message: chunks.length > 1 ? `자료를 ${chunks.length}조각으로 나눠 동시에 읽는 중…` : "핵심 개념 찾는 중…" });

  const results: ({ outline: Outline; usage: Usage } | null)[] = chunks.map(() => null);
  const errors: AiError[] = [];
  let usage: Usage | undefined;
  const merged = () => mergeConcepts(results.map((r, i) => ({ concepts: r?.outline.concepts ?? [], quota: chunks[i].quota })), req.count);
  const announce = () => send({ type: "found", terms: merged().map((c) => c.term) });

  await Promise.all(
    chunks.map(async (ch, i) => {
      try {
        const r = await callJson({
          model: req.model,
          effort: req.effort,
          system: OUTLINE_SYSTEM,
          user: chunkContent(ch, req, photos),
          schema: DirectorSchema,
          maxTokens: LIMITS.maxOutputTokens.outline,
          deadlineMs: Number(process.env.AI_DEADLINE_MS ?? 200_000),
          signal,
        });
        usage = sumUsage(usage, r.usage);
        const { outline } = checkConcepts(r.raw);
        results[i] = { outline, usage: r.usage };
        announce();
      } catch (e) {
        if (e instanceof AiError) {
          usage = sumUsage(usage, e.usage);
          errors.push(e);
        } else throw e;
      }
    }),
  );

  const done = results.filter((r): r is { outline: Outline; usage: Usage } => !!r);
  if (!done.length) throw errors[0] ?? new AiError("개념을 찾지 못했어요", "NO_CONCEPTS", 422);
  const { concepts, notes } = applyPlanRules(merged());
  if (notes.length) console.info("[outline] plan rules:", notes.join(" / "));
  if (!concepts.length) throw new AiError("자료에서 카드로 만들 개념을 찾지 못했어요. 다른 쪽 범위로 해 볼까요?", "NO_CONCEPTS", 422);

  // 제목·과목은 가장 많이 나온 값, 없으면 첫 조각
  const mode = (vals: string[]) => {
    const m = new Map<string, number>();
    for (const v of vals) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  };
  const outline: Outline = {
    deckTitle: done[0].outline.deckTitle || req.name.replace(/\.[^.]+$/, ""),
    subject: mode(done.map((d) => d.outline.subject)),
    language: "ko",
    concepts,
  };
  if (errors.length) send({ type: "status", message: `일부 조각을 읽지 못해 ${concepts.length}개로 만들어요` });
  return { outline, usage: usage ?? sumUsage() };
}
