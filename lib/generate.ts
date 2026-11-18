"use client";
// 생성 파이프라인 (브라우저 쪽 지휘):
//   자료 읽기 → 쪽 범위 고르기(PDF는 항상, 쪽 미리보기는 뒤에서 그린다) → 개념 뽑기 + 그림 판단(/api/outline)
//   → 개념별 텍스트 숏츠(/api/card, 2장씩 동시) → 저장
// 텍스트 숏츠와 모션은 같은 카드(TextShort)를 다르게 보여 줄 뿐이라, 어느 쪽을 골라도 AI 호출은 같다.
// 서버가 카드를 검사·재시도하고, 그래도 안 되면 기본 카드로 대신한다.
// 요청이 몰리거나 연결이 끊긴 카드는 여기서 잠시 뒤 다시 부르고, 끝내 안 되면 기본 카드로 채운다.
import { ApiError, RETRYABLE, addUsage, postStream } from "./api";
import { paletteOf, withPalette } from "./cards";
import { isImage, isPdf } from "./extract";
import { fallbackScene } from "./fallback";
import { imageToJpeg } from "./images";
import { LIMITS } from "./models";
import { NEXT_PALETTE } from "./normalize";
import { SCANNED_BELOW, hashBytes, isScannedDoc, openPdf, pageThumb, readPdfPages, renderPageJpeg, type PdfPage } from "./pdf";
import {
  PALETTES,
  type Card,
  type CardResult,
  type Deck,
  type Outline,
  type OutlineRequest,
  type Palette,
  type RenderMode,
  type Scene,
  type SceneRequest,
  type Usage,
} from "./schema";
import { findDeckByKey, newId, saveDeck } from "./storage";

export type JobPhase = "reading" | "range" | "outline" | "scenes" | "done" | "error";

export interface RangeInfo {
  /** 추천 범위 */
  from: number;
  to: number;
  maxPage: number;
  /** 쪽마다 글자 수 (공백 뺀) */
  chars: number[];
  totalChars: number;
  /** 한 번에 보낼 수 있는 글자 수 */
  maxChars: number;
  /** 글자가 없는 PDF(스캔본): 쪽을 그림으로 보낸다 */
  scanned: boolean;
  /** 스캔본일 때 한 번에 보낼 수 있는 쪽 수 */
  maxPages: number;
  /** 글자 PDF에서 글자가 이보다 적은 쪽은 그림으로 읽는다 (한 번에 maxImages장까지) */
  imageBelow: number;
  maxImages: number;
  /** 쪽 미리보기 (고르는 동안 뒤에서 하나씩 채워진다) */
  thumbs: (string | null)[];
}

export interface JobState {
  phase: JobPhase;
  message: string;
  progress: number;
  fileName: string;
  /** 개념 뽑기에서 찾은 개념 이름과 개념마다 고른 그림 틀 (뽑는 중에도 채워진다) */
  found: string[];
  templates: string[];
  ready: number;
  total: number;
  mode: RenderMode;
  deck?: Deck;
  range?: RangeInfo;
  usage?: Usage;
  error?: string;
  errorCode?: string;
  /** 개념 뽑기에서 첫 개념이 나오기 전 */
  thinking?: boolean;
  /** 이 단계가 시작된 시각 (경과 시간 표시) */
  phaseAt: number;
  startedAt: number;
}

export interface JobHandle {
  cancel: () => void;
  retryCard: (id: string) => Promise<void>;
  chooseRange: (r: { from: number; to: number }) => void;
}

export interface JobOptions {
  count: number;
  mode: RenderMode;
  model?: string;
}

export const MAX_CHARS = LIMITS.maxChars;
/** 카드는 2장씩 동시에 만든다 (요청 한도에 덜 걸리고, 예상 시간도 이 기준) */
export const CONCURRENCY = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stripExt = (s: string) => s.replace(/\.[^.]+$/, "");
/** 다시 시도해도 소용없는 오류: 남은 카드도 멈춘다 */
const FATAL = new Set(["NO_KEY", "BAD_KEY", "NO_CREDIT", "BAD_MODEL", "LIMIT"]);

/** from 쪽부터 한 번에 보낼 수 있는 끝 쪽: 글자 PDF는 글자 수 한도, 스캔본은 쪽 수 한도 */
export function fitRange(chars: number[], from: number, scanned: boolean): number {
  if (scanned) return Math.min(chars.length, from + LIMITS.maxImages - 1);
  let acc = 0;
  let end = from - 1;
  while (end < chars.length && acc + chars[end] <= MAX_CHARS) acc += chars[end++];
  return Math.max(from, end);
}

function describe(e: unknown): { message: string; code: string } {
  if (e instanceof ApiError) return { message: e.message, code: e.code };
  const err = e as Error & { code?: string };
  return { message: err?.message || "알 수 없는 오류가 났어요", code: err?.code ?? "ERROR" };
}

function sceneRequestFor(d: Deck, card: Card, model?: string): SceneRequest {
  return {
    concept: card.concept,
    deck: { title: d.title, subject: d.subject, terms: d.cards.map((c) => c.concept.term) },
    index: Math.max(0, d.cards.findIndex((c) => c.id === card.id)),
    total: d.cards.length,
    mode: d.mode ?? "text",
    model: model ?? d.model,
    others: d.cards.filter((c) => c.id !== card.id).map((c) => ({ term: c.concept.term, definition: c.concept.definition })),
  };
}

/**
 * 카드 한 장 만들기: /api/card 가 그림 틀 칸을 채워 텍스트 숏츠(short)를 돌려준다.
 * 모션 보기는 같은 short로 브라우저에서 만든다(추가 AI 호출 없음). 끝내 실패하면 기본 카드(scene).
 */
async function generateOne(d: Deck, card: Card, signal?: AbortSignal, model?: string): Promise<{ patch: Partial<Card>; usage?: Usage }> {
  const req = sceneRequestFor(d, card, model);
  const prev = d.cards[req.index - 1];
  const prevPalette = prev ? paletteOf(prev) : undefined;
  const res = await postStream<CardResult>("/api/card", { ...req, prevPalette }, { signal });
  const r = res.data;
  return { patch: { short: r.short, scene: r.short ? null : (r.scene ?? null), fallback: r.fallback }, usage: res.usage };
}

/**
 * 바로 앞·뒤 카드와 배경색이 겹치면 다른 색으로 돌린다. 카드는 끝나는 순서가 제각각이라
 * 끝난 시점의 덱을 보고 이 카드만 고친다(이미 보고 있는 다른 카드 색은 바꾸지 않는다).
 * 바꿀 색 순서는 디자인 쪽 규칙과 같다: 원래 색 → 짝 색(NEXT_PALETTE) → 그 짝 → 나머지.
 */
function withPaletteFix(d: Deck, card: Card, patch: Partial<Card>): Partial<Card> {
  const own = paletteOf(patch);
  if (!own) return patch;
  // 카드 객체는 상태가 바뀔 때마다 새로 만들어지므로 id로 찾는다
  const i = d.cards.findIndex((c) => c.id === card.id);
  if (i < 0) return patch;
  const near = [d.cards[i - 1], d.cards[i + 1]].map((c) => (c ? paletteOf(c) : undefined)).filter(Boolean);
  const order: Palette[] = [own, NEXT_PALETTE[own], NEXT_PALETTE[NEXT_PALETTE[own]], ...PALETTES];
  const pick = order.find((p) => !near.includes(p)) ?? own;
  return pick === own ? patch : withPalette(patch, pick);
}

export function startJob(files: File[], opts: JobOptions, onState: (s: JobState) => void): JobHandle {
  const ctrl = new AbortController();
  let cancelled = false;
  let resolveRange: ((r: { from: number; to: number }) => void) | null = null;
  const name = files[0]?.name ?? "자료";
  const photos = files.length > 0 && files.every(isImage);
  const fallbackTitle = photos && files.length > 1 ? `${stripExt(name)} 외 ${files.length - 1}장` : stripExt(name);

  const now = Date.now();
  let st: JobState = {
    phase: "reading",
    message: "자료 읽는 중…",
    progress: 0.04,
    fileName: name,
    found: [],
    templates: [],
    ready: 0,
    total: 0,
    mode: opts.mode,
    phaseAt: now,
    startedAt: now,
  };
  const set = (p: Partial<JobState>) => {
    if (cancelled) return;
    if (p.phase && p.phase !== st.phase) p = { ...p, phaseAt: Date.now() };
    st = { ...st, ...p };
    onState(st);
  };

  let deck: Deck | null = null;
  let usage: Usage | undefined;
  let fatal: { message: string; code: string } | null = null;
  const running = new Set<string>();

  const putCard = (id: string, patch: Partial<Card>) => {
    if (!deck) return;
    deck = { ...deck, cards: deck.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
    const ready = deck.cards.filter((c) => c.status === "ready").length;
    const settled = deck.cards.filter((c) => c.status !== "pending").length;
    set({ deck, ready, progress: 0.4 + 0.6 * (settled / Math.max(1, deck.cards.length)) });
  };

  const runCard = async (id: string) => {
    if (running.has(id)) return;
    running.add(id);
    try {
      for (let attempt = 0; ; attempt++) {
        const d = deck;
        const card = d?.cards.find((c) => c.id === id);
        if (!d || !card || cancelled) return;
        if (fatal) {
          putCard(id, { status: "error", error: fatal.message });
          return;
        }
        putCard(id, { status: "pending", error: undefined });
        try {
          const res = await generateOne(d, card, ctrl.signal, opts.model);
          usage = addUsage(usage, res.usage);
          if (deck) deck = { ...deck, usage };
          // 다른 카드도 동시에 만들어지므로, 끝난 시점의 덱을 보고 앞뒤 색 겹침을 피한다
          const patch = deck ? withPaletteFix(deck, card, res.patch) : res.patch;
          putCard(id, { ...patch, status: "ready", error: undefined });
          set({ usage });
          return;
        } catch (e) {
          if (cancelled) return;
          const err = describe(e);
          if (FATAL.has(err.code)) {
            fatal = err;
            putCard(id, { status: "error", error: err.message });
            return;
          }
          if (RETRYABLE.has(err.code) && attempt < 2) {
            await sleep(attempt === 0 ? 3000 : 9000);
            continue;
          }
          // 끝내 안 되면 AI 없이 기본 텍스트 카드로 채운다
          const req = sceneRequestFor(d, card);
          const scene: Scene = fallbackScene(card.concept, req.others ?? [], req.index);
          const patch = deck ? withPaletteFix(deck, card, { scene, short: null }) : { scene, short: null };
          putCard(id, { ...patch, status: "ready", fallback: true, error: undefined });
          return;
        }
      }
    } finally {
      running.delete(id);
      if (deck && !cancelled) saveDeck(deck);
    }
  };

  (async () => {
    set({});
    try {
      /* ---------- 1. 자료 읽기 ---------- */
      const pages: OutlineRequest["pages"] = [];
      const images: OutlineRequest["images"] = [];
      let keyBase = "";
      let range: { from: number; to: number } | undefined;

      if (files.some(isPdf)) {
        const file = files.find(isPdf)!;
        const buf = await file.arrayBuffer();
        let doc: Awaited<ReturnType<typeof openPdf>>;
        try {
          doc = await openPdf(buf);
        } catch (e) {
          const pw = (e as Error)?.name === "PasswordException";
          throw new ApiError(pw ? "암호가 걸린 PDF는 열 수 없어요. 암호를 푼 파일로 올려 주세요." : "PDF를 열지 못했어요. 파일이 손상되지 않았는지 확인해 주세요.", "BAD_PDF");
        }
        try {
          const all: PdfPage[] = await readPdfPages(doc, (dn, t) => set({ message: `자료 읽는 중… ${dn}/${t}쪽`, progress: 0.04 + 0.06 * (dn / t) }));
          if (cancelled) return;
          const chars = all.map((p) => p.chars);
          const totalChars = chars.reduce((a, b) => a + b, 0);
          const scanned = isScannedDoc(chars);
          const thumbs: (string | null)[] = Array(all.length).fill(null);
          set({
            phase: "range",
            message: "",
            progress: 0.1,
            range: {
              from: 1,
              to: fitRange(chars, 1, scanned),
              maxPage: all.length,
              chars,
              totalChars,
              maxChars: MAX_CHARS,
              scanned,
              maxPages: LIMITS.maxImages,
              imageBelow: SCANNED_BELOW,
              maxImages: LIMITS.maxImages,
              thumbs,
            },
          });
          // 쪽 미리보기는 고르는 동안 뒤에서 하나씩 그린다 (없어도 고를 수 있다)
          void (async () => {
            for (let n = 1; n <= Math.min(all.length, 150); n++) {
              if (cancelled || st.phase !== "range") break;
              try {
                thumbs[n - 1] = await pageThumb(doc, n);
                if (st.phase === "range" && st.range) set({ range: { ...st.range, thumbs: thumbs.slice() } });
              } catch {
                /* 미리보기는 없어도 된다 */
              }
            }
          })();
          const r = await new Promise<{ from: number; to: number }>((res) => (resolveRange = res));
          if (cancelled) return;
          const from = Math.min(all.length, Math.max(1, Math.round(r.from)));
          const to = Math.min(fitRange(chars, from, scanned), Math.max(from, Math.round(r.to)));
          range = { from, to };
          set({ phase: "reading", message: scanned ? "쪽을 그림으로 바꾸는 중…" : "고른 쪽 준비 중…", progress: 0.12 });
          let budget = MAX_CHARS;
          for (const p of all.slice(from - 1, to)) {
            // 스캔본은 모든 쪽, 글자 PDF는 글자가 거의 없는 쪽(그림 위주 슬라이드)만 그림으로 읽는다
            if (scanned || p.chars < SCANNED_BELOW) {
              if (images.length >= LIMITS.maxImages) continue;
              set({ message: `그림으로 된 ${p.n}쪽 읽는 중…` });
              images.push({ n: p.n, media_type: "image/jpeg", data: await renderPageJpeg(doc, p.n) });
            } else if (budget > 0) {
              const text = p.text.slice(0, Math.max(200, budget + 400));
              pages.push({ n: p.n, text });
              budget -= p.chars;
            }
          }
          keyBase = `${await hashBytes(buf)}:${from}-${to}`;
        } finally {
          void doc.destroy();
        }
      } else {
        const list = files.filter(isImage).slice(0, LIMITS.maxImages);
        if (!list.length) throw new ApiError("PDF나 사진(JPG·PNG)을 올려 주세요", "BAD_FILE");
        const hashes: string[] = [];
        for (let i = 0; i < list.length; i++) {
          set({ message: `사진 읽는 중… ${i + 1}/${list.length}`, progress: 0.04 + 0.08 * ((i + 1) / list.length) });
          images.push({ n: i + 1, media_type: "image/jpeg", data: await imageToJpeg(list[i]) });
          hashes.push(await hashBytes(await list[i].arrayBuffer()));
        }
        keyBase = hashes.join("+");
      }
      if (cancelled) return;
      if (!pages.length && !images.length) throw new ApiError("고른 쪽에 읽을 내용이 없어요. 다른 범위를 골라 주세요.", "EMPTY");

      /* ---------- 같은 자료로 만든 덱이 있으면 다시 만들지 않는다 ---------- */
      // 텍스트·모션은 같은 카드를 다르게 보여 줄 뿐이라 열쇠에 넣지 않는다
      const key = `${keyBase}:${opts.count}:${opts.model ?? ""}`;
      const cached = findDeckByKey(key);
      if (cached) {
        set({
          phase: "done",
          message: "이미 만든 덱을 열어요",
          progress: 1,
          deck: cached,
          found: cached.cards.map((c) => c.concept.term),
          templates: cached.cards.map((c) => c.concept.plan?.template ?? ""),
          ready: cached.cards.length,
          total: cached.cards.length,
        });
        return;
      }

      /* ---------- 2. 개념 뽑기 ---------- */
      set({ phase: "outline", message: "핵심 개념 찾는 중…", progress: 0.16, thinking: true, found: [], templates: [] });
      const body: OutlineRequest = { name, pages, images, count: opts.count, mode: opts.mode, model: opts.model };
      // 요청 본문 4.5MB 제한: 넘치면 뒤쪽 그림부터 뺀다
      while (images.length && JSON.stringify(body).length > LIMITS.maxBodyBytes) images.pop();
      let outline: Outline | null = null;
      for (let attempt = 0; !outline; attempt++) {
        try {
          const res = await postStream<Outline>("/api/outline", body, {
            signal: ctrl.signal,
            onStatus: (m) => m && set({ message: m }),
            onFound: (terms, templates) =>
              set({ thinking: false, found: terms, templates, progress: 0.16 + 0.2 * Math.min(1, terms.length / opts.count) }),
          });
          outline = res.data;
          usage = addUsage(usage, res.usage);
        } catch (e) {
          const err = describe(e);
          if (cancelled) return;
          if (RETRYABLE.has(err.code) && attempt < 1) {
            set({ message: "잠시 뒤 다시 시도하는 중…", thinking: true, found: [], templates: [] });
            await sleep(4000);
            continue;
          }
          throw e;
        }
      }
      if (!outline.concepts.length) throw new ApiError("자료에서 개념을 찾지 못했어요. 다른 쪽 범위로 해 볼까요?", "NO_CONCEPTS");

      /* ---------- 3. 개념별 카드 ---------- */
      const id = `deck-${newId()}`;
      deck = {
        id,
        title: outline.deckTitle || fallbackTitle,
        subject: outline.subject,
        source: name,
        createdAt: Date.now(),
        cards: outline.concepts.map((c, i) => ({ id: `${id}-${i}`, concept: c, scene: null, status: "pending" as const })),
        mode: opts.mode,
        model: opts.model,
        usage,
        key,
        range,
      };
      saveDeck(deck);
      set({
        phase: "scenes",
        message: "개념별 카드 만드는 중…",
        found: outline.concepts.map((c) => c.term),
        templates: outline.concepts.map((c) => c.plan?.template ?? ""),
        thinking: false,
        total: deck.cards.length,
        ready: 0,
        deck,
        usage,
        progress: 0.4,
      });

      const queue = deck.cards.map((c) => c.id);
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
          for (let next = queue.shift(); next; next = queue.shift()) await runCard(next);
        }),
      );
      if (cancelled || !deck) return;

      const finalDeck: Deck = { ...deck, usage };
      deck = finalDeck;
      saveDeck(finalDeck);
      // fatal은 카드 작업(콜백) 안에서 바뀌므로 타입 좁히기를 피해서 읽는다
      const stop = fatal as { message: string; code: string } | null;
      if (stop && !finalDeck.cards.some((c) => c.status === "ready")) {
        set({ phase: "error", error: stop.message, errorCode: stop.code, deck: finalDeck });
        return;
      }
      set({ phase: "done", progress: 1, deck: finalDeck, usage });
    } catch (e) {
      if (cancelled) return;
      const err = describe(e);
      if (err.code === "CANCELLED") return;
      set({ phase: "error", error: err.message, errorCode: err.code, thinking: false });
    }
  })();

  return {
    cancel: () => {
      cancelled = true;
      ctrl.abort();
      resolveRange?.({ from: 1, to: 1 });
    },
    retryCard: async (cardId) => {
      fatal = null;
      await runCard(cardId);
    },
    chooseRange: (r) => resolveRange?.(r),
  };
}

/** 저장된 덱의 카드 하나를 새로 만든다 (피드의 "다시 만들기") */
export async function regenerateCard(deck: Deck, cardId: string): Promise<{ patch: Partial<Card>; usage?: Usage }> {
  const card = deck.cards.find((c) => c.id === cardId);
  if (!card) throw new ApiError("카드를 찾지 못했어요", "NOT_FOUND");
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await generateOne(deck, card);
      return { ...res, patch: withPaletteFix(deck, card, res.patch) };
    } catch (e) {
      const err = describe(e);
      if (RETRYABLE.has(err.code) && attempt < 1) {
        await sleep(3000);
        continue;
      }
      throw e;
    }
  }
}
