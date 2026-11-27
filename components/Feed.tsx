"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { conceptNameOf, expandParts, isShowable, paletteOf, problemsOf, quizOf } from "@/lib/cards";
import type { Card, Deck } from "@/lib/schema";
import type { Settings } from "@/lib/storage";
import { canSpeak, playSfx, primeVoice, setSoundEnabled, unlockAudio } from "@/lib/sfx";
import { fallbackScene } from "@/lib/fallback";
import { burstFrom } from "@/lib/fx";
import { W } from "@/motion/timeline";
import ExamTab from "./ExamTab";
import QuizCard from "./QuizCard";
import SceneCard, { type MotionSrc } from "./SceneCard";
import StyleACard from "./StyleACard";
import TextShortCard from "./TextShortCard";
import { Sheet, Toast, useToast } from "./ui";

type Item =
  | { kind: "card"; key: string; card: Card }
  | { kind: "pending"; key: string; card: Card }
  | { kind: "quiz"; key: string; card: Card; retry: boolean }
  | { kind: "end"; key: string };

interface Props {
  deck: Deck;
  generating: boolean;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onBack: () => void;
  onDeckChange: (d: Deck) => void;
  onRetryCard: (cardId: string) => void;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildItems(deck: Deck, s: Settings, extras: { afterKey: string; cardId: string; n: number }[], showEnd: boolean): Item[] {
  const isA = deck.cards.some((c) => c.spec);
  // 스타일A 덱은 여러 편으로 나뉜 개념을 편마다 한 장으로 펼치고, 편 순서가 깨지지 않게 섞지 않는다
  const cards = isA ? expandParts(deck.cards) : s.shuffle ? seededShuffle(deck.cards, hash(deck.id)) : deck.cards;
  const items: Item[] = [];
  let window: Card[] = [];
  // 스타일A 덱: 개념(여러 편이면 마지막 편)이 끝날 때마다 암기 퀴즈가 자동으로 나온다
  if (isA) {
    cards.forEach((card, i) => {
      if (isShowable(card)) {
        items.push({ kind: "card", key: `c-${card.id}`, card });
        window.push(card);
      } else items.push({ kind: "pending", key: `p-${card.id}`, card });
      const nextCard = cards[i + 1];
      if (s.quizEvery > 0 && window.length && (!nextCard || conceptNameOf(nextCard) !== conceptNameOf(card))) {
        const q = [...window].reverse().find((c) => quizOf(c));
        if (q) items.push({ kind: "quiz", key: `q-${q.id}`, card: q, retry: false });
        window = [];
      }
    });
  } else
  cards.forEach((card, i) => {
    if (isShowable(card)) {
      items.push({ kind: "card", key: `c-${card.id}`, card });
      window.push(card);
    } else items.push({ kind: "pending", key: `p-${card.id}`, card });
    if (s.quizEvery > 0 && (i + 1) % s.quizEvery === 0 && window.length) {
      const q = window[0]; // the earliest card of the block → spaced recall
      items.push({ kind: "quiz", key: `q-${q.id}`, card: q, retry: false });
      window = [];
    }
  });
  for (const ex of extras) {
    const card = cards.find((c) => c.id === ex.cardId) ?? deck.cards.find((c) => c.id === ex.cardId);
    if (!card || !quizOf(card)) continue;
    const at = items.findIndex((it) => it.key === ex.afterKey);
    const item: Item = { kind: "quiz", key: `r-${ex.cardId}-${ex.n}`, card, retry: true };
    if (at >= 0) items.splice(at + 1, 0, item);
    else items.push(item);
  }
  if (showEnd) items.push({ kind: "end", key: "end" });
  return items;
}

const QUIZ_OPTIONS = [0, 1, 2, 3, 5];
const SPEEDS = [0.75, 1, 1.25, 1.5];
/** 모션으로 보여 줄 그림 틀: 단계·순환·원인→결과·시간·주고받기·그래프 (11/26 기획 피드백, 디자인 확정 B안) */
const MOTION_TEMPLATES = new Set<string>(["flow", "cycle", "chain", "timeline", "exchange", "chart"]);

export default function Feed({ deck, generating, settings, onSettings, onBack, onDeckChange, onRetryCard }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 390, h: 844 });
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [extras, setExtras] = useState<{ afterKey: string; cardId: string; n: number }[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [quizMenu, setQuizMenu] = useState(false);
  const [detail, setDetail] = useState<Card | null>(null);
  const [notes, setNotes] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useToast();
  // 시험문제 탭: 왼쪽으로 넘기면 열린다 (2026-11-25)
  const [tab, setTab] = useState<"concept" | "exam">("concept");
  const [examFilter, setExamFilter] = useState<string | null>(null);
  const problems = useMemo(() => problemsOf(deck), [deck]);
  const hasExam = problems.length > 0;
  const isStyleA = deck.cards.some((c) => c.spec);
  const openExam = useCallback(
    (concept: string | null) => {
      if (!hasExam) return;
      playSfx("swipe");
      setExamFilter(concept);
      setTab("exam");
    },
    [hasExam],
  );
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const swipe = useRef<{ x: number; y: number; ok: boolean } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const el = e.target as HTMLElement;
    swipe.current = { x: t.clientX, y: t.clientY, ok: e.touches.length === 1 && !el.closest("[data-noswipe],input,[role=dialog]") };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s0 = swipe.current;
    swipe.current = null;
    if (!s0?.ok || !hasExam) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s0.x;
    const dy = t.clientY - s0.y;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    if (dx < 0 && tab === "concept") openExam(null);
    else if (dx > 0 && tab === "exam") setTab("concept");
  };
  const progressBar = useRef<HTMLDivElement>(null);

  useEffect(() => setSoundEnabled(settings.sound), [settings.sound]);

  // measure the phone screen → composition height that fills it exactly
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let lastH = el.clientHeight;
    const ro = new ResizeObserver(() => {
      // 화면 높이가 바뀌면(앱 안 브라우저 툴바 등) 보던 장이 어긋나지 않게 다시 맞춘다
      if (lastH && el.clientHeight !== lastH) {
        const i = Math.round(el.scrollTop / lastH);
        el.scrollTop = i * el.clientHeight;
      }
      lastH = el.clientHeight;
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const compHeight = Math.round(Math.min(2400, Math.max(1700, (W * size.h) / Math.max(1, size.w))));

  const allSettled = !generating && deck.cards.every((c) => c.status !== "pending");
  const items = useMemo(() => buildItems(deck, settings, extras, allSettled), [deck, settings, extras, allSettled]);
  const current = items[Math.min(index, items.length - 1)];
  // 완주 화면에 도착하면 제목에서 파티클이 한 번 터짐 (정답·완료 순간 = 팡 파티클)
  const finishTitle = useRef<HTMLHeadingElement | null>(null);
  const atEnd = current?.kind === "end";
  useEffect(() => {
    if (!atEnd) return;
    const t = setTimeout(() => burstFrom(finishTitle.current, undefined, 24), 250);
    return () => clearTimeout(t);
  }, [atEnd]);
  const lastConceptBefore = useMemo(() => {
    let n = 0;
    for (let i = 0; i <= Math.min(index, items.length - 1); i++) if (items[i].kind === "card" || items[i].kind === "pending") n++;
    return n;
  }, [items, index]);

  const scrollTo = useCallback(
    (i: number) => {
      const el = scroller.current;
      if (!el) return;
      const clamped = Math.max(0, Math.min(items.length - 1, i));
      el.scrollTo({ top: clamped * el.clientHeight, behavior: "smooth" });
    },
    [items.length],
  );

  /* 카드 더미 넘김 (2026-11-23 확정 ②): 스크롤 스냅은 그대로 두고, 스크롤 진행률로
     지금 카드는 왼쪽 위로 날아가고 다음 카드는 뒤에서 앞으로 커지게 그린다.
     손가락을 그대로 따라가고, 키보드·버튼 넘김(scrollTo)도 같은 움직임이 된다. */
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const stackRaf = useRef(0);
  const applyStack = useCallback(() => {
    stackRaf.current = 0;
    const el = scroller.current;
    if (!el) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const pos = el.scrollTop / Math.max(1, el.clientHeight);
    const top = Math.floor(pos);
    layers.current.forEach((node, i) => {
      if (!node) return;
      if (reduce || (i !== top && i !== top + 1)) {
        if (node.style.transform) node.style.transform = "";
        return;
      }
      const p = pos - i; // 0~1: 위로 떠나는 중, -1~0: 아래에서 다가오는 중
      if (p >= 0) {
        if (p < 0.001) {
          node.style.transform = "";
          return;
        }
        // 날아가는 곡선 cubic-bezier(.5,0,.7,.4)에 가깝게: 처음엔 느리게 떼고 끝에서 휙
        const e = p * p * (0.6 + 0.4 * p);
        node.style.transform = `translateY(${(p * 100).toFixed(2)}%) translate(${(-30 * e).toFixed(2)}%, ${(-110 * e).toFixed(2)}%) rotate(${(-14 * e).toFixed(2)}deg)`;
      } else {
        const q = -p; // 1 → 0 으로 다가옴
        // 다가오는 곡선 cubic-bezier(.2,.9,.3,1.1): 빨리 커지고 끝에서 살짝 넘쳤다 멈춤
        const k = 1 - q;
        const g = 1 - Math.pow(1 - k, 3) + 0.05 * Math.sin(Math.PI * k) * k;
        const scale = 0.86 + 0.14 * g;
        node.style.transform = `translateY(${(-q * 100).toFixed(2)}%) translateY(${(6 * (1 - g)).toFixed(2)}%) scale(${scale.toFixed(4)})`;
      }
    });
  }, []);
  useEffect(() => {
    applyStack();
    const onResize = () => applyStack();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (stackRaf.current) cancelAnimationFrame(stackRaf.current);
    };
  }, [applyStack, items.length]);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    if (!stackRaf.current) stackRaf.current = requestAnimationFrame(applyStack);
    const i = Math.round(el.scrollTop / Math.max(1, el.clientHeight));
    setIndex((prev) => {
      if (prev !== i) {
        if (progressBar.current) progressBar.current.style.width = "0%";
      }
      return i;
    });
  }, [applyStack]);

  // keyboard navigation (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (detail || notes || settingsOpen) return;
      if (e.key === "ArrowRight" && tab === "concept") return openExam(null);
      if (e.key === "ArrowLeft" && tab === "exam" && !(e.target as HTMLElement)?.closest?.("input")) return setTab("concept");
      if (tab !== "concept") return;
      if (["ArrowDown", "PageDown", "j"].includes(e.key)) {
        e.preventDefault();
        scrollTo(index + 1);
      } else if (["ArrowUp", "PageUp", "k"].includes(e.key)) {
        e.preventDefault();
        scrollTo(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, scrollTo, detail, notes, settingsOpen, tab, openExam]);

  const set = (patch: Partial<Settings>, msg?: string) => {
    onSettings({ ...settings, ...patch });
    if (msg) setToast(msg);
    playSfx("tap");
  };

  const answer = (item: Extract<Item, { kind: "quiz" }>, i: number, at: number) => {
    unlockAudio();
    const quiz = quizOf(item.card)!;
    setAnswers((a) => ({ ...a, [item.key]: i }));
    const ok = i === quiz.answer;
    playSfx(ok ? "correct" : "wrong", ok ? streak + 1 : 1);
    setStreak((s) => {
      const n = ok ? s + 1 : 0;
      setBestStreak((b) => Math.max(b, n));
      return n;
    });
    const wrong = new Set(deck.wrong ?? []);
    if (ok) {
      if (item.retry) wrong.delete(item.card.id);
    } else {
      wrong.add(item.card.id);
      if (settings.retryWrong) {
        const after = items[Math.min(at + 3, items.length - 1)];
        const afterKey = after?.kind === "end" ? items[items.length - 2]?.key : after?.key;
        if (afterKey) setExtras((x) => [...x, { afterKey, cardId: item.card.id, n: x.length + 1 }]);
      }
    }
    onDeckChange({ ...deck, wrong: [...wrong] });
  };

  /** 완주 화면에서 오답 퀴즈를 끝 바로 앞에 다시 넣는다. 화면 위치는 그대로라 첫 오답 퀴즈가 바로 보인다 */
  const redoWrong = (endAt: number) => {
    playSfx("tap");
    const before = items[endAt - 1]?.key;
    if (!before) return;
    setExtras((x) => {
      const ids = deck.cards.filter((c) => deck.wrong?.includes(c.id) && quizOf(c)).map((c) => c.id);
      // 같은 자리에 넣으면 나중 것이 앞에 오므로 거꾸로 넣어 원래 순서를 지킨다
      return [...x, ...ids.reverse().map((cardId, k) => ({ afterKey: before, cardId, n: x.length + k + 1 }))];
    });
    // 브라우저가 완주 화면을 붙잡고 같이 내려가지 않도록, 새로 들어온 첫 퀴즈 자리로 바로 맞춘다
    requestAnimationFrame(() => {
      const el = scroller.current;
      if (el) el.scrollTop = endAt * el.clientHeight;
    });
  };

  const quizItems = items.filter((i) => i.kind === "quiz");
  const answered = quizItems.filter((i) => answers[i.key] !== undefined);
  const correctCount = answered.filter((i) => i.kind === "quiz" && answers[i.key] === quizOf(i.card)?.answer).length;
  const wrongCards = deck.cards.filter((c) => deck.wrong?.includes(c.id) && quizOf(c));
  const view = settings.mode;
  const hasShorts = deck.cards.some((c) => c.short);

  /** 카드 한 장 그리기: 텍스트 숏츠(기본) · 같은 카드로 만든 템플릿 모션 · (short가 없으면) 장면 */
  const renderCard = (card: Card, mode: "active" | "near" | "far", i: number) => {
    const live = mode === "active";
    const onProgress = (p: number) => {
      if (progressBar.current && live) progressBar.current.style.width = `${Math.round(p * 1000) / 10}%`;
    };
    // 모션은 과정·순서·변화를 보여 주는 6가지 그림 틀에만 (11/26 확정 B안). 나머지는 모션 보기에서도 텍스트 카드
    const asText = !!card.short && (view === "text" || !MOTION_TEMPLATES.has(card.short.visual.type));
    const onEnded = () => {
      if (!settings.autoNext || !live) return;
      // 모션이 끝난 뒤 화면 글자 수만큼 더 읽을 시간 (11/26 확정 B안): 1자당 0.06초, 1.5~4초
      const chars = card.short ? Array.from(card.short.term + card.short.definition).length : 0;
      const wait = asText ? 350 : Math.round(Math.max(1.5, Math.min(4, chars * 0.06)) * 1000 / Math.max(0.5, settings.speed));
      setTimeout(() => scrollTo(i + 1), wait);
    };
    if (card.spec && !broken[card.id]) {
      return (
        <StyleACard
          spec={card.spec}
          mode={mode === "active" && tab !== "concept" ? "near" : mode}
          speed={settings.speed}
          sound={settings.sound}
          voice={settings.voice}
          loop={!settings.autoNext}
          onEnded={onEnded}
          onProgress={onProgress}
          onError={() => setBroken((b) => (b[card.id] ? b : { ...b, [card.id]: true }))}
        />
      );
    }
    if (card.short && asText) {
      return <TextShortCard short={card.short} mode={mode} sound={live && settings.sound} speed={settings.speed} onProgress={onProgress} onEnded={onEnded} />;
    }
    // 스타일A 영상을 그리지 못한 카드는 AI 없이 만드는 기본 카드로 대신 보여 준다
    const plain = card.scene ?? fallbackScene(card.concept, deck.cards.filter((c) => c.id !== card.id).map((c) => ({ term: c.concept.term, definition: c.concept.definition })), i);
    const src: MotionSrc = card.short ? { kind: "template", short: card.short, plan: card.concept.plan } : { kind: "scene", scene: plain };
    return (
      <SceneCard
        src={src}
        mode={mode}
        compHeight={compHeight}
        speed={mode === "far" ? 1 : settings.speed}
        sound={live && settings.sound}
        captions={mode !== "far" && settings.captions}
        autoNext={live && settings.autoNext}
        onEnded={onEnded}
        onProgress={onProgress}
      />
    );
  };
  const readyCount = deck.cards.filter((c) => c.status === "ready").length;

  /** 모션 카드(색 바탕) 위에서만 흰 글씨 상단 바, 나머지(종이 바탕)는 잉크 글씨 */
  // 모션 영상은 아주 연한 하늘 바탕(2026-11-23)이라 잉크 글씨 상단 바를 쓴다. 짙은 바탕은 예전 장면(short 없음)만
  const dark = current?.kind === "card" && !current.card.short && (!current.card.spec || !!broken[current.card.id]);
  const skyVideo = current?.kind === "card" && view === "motion" && !!current.card.short && MOTION_TEMPLATES.has(current.card.short.visual.type);
  // 각진 작은 조작 버튼 (11/24 C안, 11/27 수치표 반영): 보이는 높이 30px, 모서리 8px, 아래 단색 판 2px.
  // 눌리는 영역은 바깥으로 7px씩 넓혀 44px
  const ctl = `relative flex h-[30px] shrink-0 items-center before:absolute before:inset-[-7px] before:content-[''] gap-1 rounded-[8px] border-2 px-2.5 text-[13px] font-bold transition-transform active:translate-y-[2px] active:shadow-none ${
    dark ? "border-white bg-white/15 text-white shadow-[0_2px_0_#fff]" : "border-[var(--ink)] bg-white text-[var(--ink)] shadow-[0_2px_0_var(--ink)]"
  }`;
  const fg = dark ? "#fff" : "var(--ink)";

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--paper)]" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{ transform: tab === "exam" ? "translateX(-100%)" : "none" }}
        aria-hidden={tab === "exam"}
      >
      {/* feed */}
      <div ref={scroller} onScroll={onScroll} className="snap-feed no-scrollbar h-full w-full overflow-y-scroll [overflow-anchor:none]">
        {items.map((it, i) => {
          const dist = Math.abs(i - index);
          return (
            <section key={it.key} className="relative h-full w-full" style={{ zIndex: items.length - i }} aria-label={it.kind === "card" ? it.card.concept.term : it.kind}>
              <div
                ref={(n) => {
                  layers.current[i] = n;
                }}
                className="relative h-full w-full overflow-hidden will-change-transform"
                style={{ transformOrigin: "50% 50%" }}
              >
              {it.kind === "card" ? (
                renderCard(it.card, dist === 0 ? "active" : dist === 1 ? "near" : "far", i)
              ) : it.kind === "pending" ? (
                <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--paper)] px-8 text-center text-[var(--ink)]">
                  {it.card.status === "error" || !generating ? (
                    <>
                      <p className="font-display text-[28px]">{it.card.concept.term}</p>
                      <p className="mt-2 text-[14px] font-semibold text-[var(--muted)]">
                        {it.card.status === "error" ? (it.card.error ?? "이 카드는 만들지 못했어요") : "만들다 멈춘 카드예요"}
                      </p>
                      <button
                        type="button"
                        onClick={() => onRetryCard(it.card.id)}
                        className="press font-display mt-5 h-14 rounded-[18px] bg-[var(--ocean)] px-7 text-[19px] text-white"
                      >
                        다시 만들기
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="h-12 w-12 animate-spin rounded-full border-[5px] border-[var(--ans)] border-t-[var(--ocean)]" />
                      <p className="font-display mt-5 text-[28px]">{it.card.concept.term}</p>
                      <p className="mt-2 text-[14px] font-semibold text-[var(--muted)]">카드를 만드는 중이에요…</p>
                    </>
                  )}
                </div>
              ) : it.kind === "quiz" ? (
                <QuizCard
                  quiz={quizOf(it.card)!}
                  term={conceptNameOf(it.card)}
                  palette={paletteOf(it.card) ?? "blue"}
                  retry={it.retry}
                  selected={answers[it.key] ?? null}
                  streak={streak}
                  onAnswer={(sel) => answer(it, sel, i)}
                  onNext={() => scrollTo(i + 1)}
                  examCount={problems.filter((p) => p.concept === conceptNameOf(it.card)).length}
                  onExam={() => openExam(conceptNameOf(it.card))}
                />
              ) : (
                <div className="flex h-full w-full flex-col bg-[var(--paper)] px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-[112px] text-[var(--ink)]">
                  <span className="self-start rounded-[8px] bg-[var(--ocean)] px-2.5 py-1 text-[13px] font-bold text-white">FINISH</span>
                  <h2 ref={finishTitle} className="font-display mt-3 text-[44px] leading-tight">완주했어요!</h2>
                  <p className="mt-1 truncate text-[14px] font-medium text-[var(--muted)]">
                    {deck.title}
                    {deck.range ? ` · ${deck.range.from === deck.range.to ? `${deck.range.from}쪽` : `${deck.range.from}–${deck.range.to}쪽`}` : ""}
                  </p>
                  <div className="mt-6 grid w-full grid-cols-3 gap-2">
                    {[
                      { k: "개념", v: `${readyCount}개`, hi: false },
                      { k: "퀴즈 정답", v: answered.length ? `${correctCount}/${answered.length}` : "-", hi: true },
                      { k: "최고 콤보", v: bestStreak ? `×${bestStreak}` : "-", hi: false },
                    ].map((s) => (
                      <div key={s.k} className={`rounded-[16px] border-[2.5px] border-[var(--ink)] px-2 py-3 text-center ${s.hi ? "bg-[var(--yellow)]" : "bg-white"}`}>
                        <div className="font-display text-[28px] leading-tight">{s.v}</div>
                        <div className="text-[13px] font-bold">{s.k}</div>
                      </div>
                    ))}
                  </div>
                  {wrongCards.length ? (
                    <div className="mt-4 overflow-hidden rounded-[16px] border-[2.5px] border-[var(--ink)] bg-white">
                      <div className="flex items-center bg-[var(--red-soft)] px-4 py-2 text-[14px] font-bold text-[var(--red)]">
                        <span>오답노트 {wrongCards.length}개</span>
                        <span className="ml-auto text-[13px]">다시 풀면 사라져요</span>
                      </div>
                      <div className="no-scrollbar max-h-[132px] overflow-y-auto">
                        {wrongCards.map((c) => (
                          <div key={c.id} className="flex items-center gap-2 border-t-[2.5px] border-[var(--ink)]/10 px-4 py-2.5 first:border-t-0">
                            <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{c.concept.term}</span>
                            {c.concept.pages ? <span className="shrink-0 text-[13px] font-medium text-[var(--muted)]">{c.concept.pages}</span> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="min-h-6 flex-1" />
                  <div className="flex w-full flex-col gap-4">
                    {hasExam ? (
                      <button type="button" onClick={() => openExam(null)} className="press press-ink font-display h-14 rounded-[18px] border-[2.5px] border-[var(--ink)] bg-[var(--yellow)] text-[19px] text-[var(--ink)]">
                        시험문제 {problems.length}개 풀러 가기 →
                      </button>
                    ) : null}
                    {wrongCards.length ? (
                      <button type="button" onClick={() => redoWrong(i)} className="press font-display h-14 rounded-[18px] bg-[var(--ocean)] text-[19px] text-white">
                        오답노트 다시 풀기 →
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => scrollTo(0)}
                      className={
                        wrongCards.length
                          ? "press press-ink font-display h-14 rounded-[18px] border-[2.5px] border-[var(--ink)] bg-white text-[19px] text-[var(--ink)]"
                          : "press font-display h-14 rounded-[18px] bg-[var(--ocean)] text-[19px] text-white"
                      }
                    >
                      처음부터 다시 보기
                    </button>
                  </div>
                </div>
              )}
              </div>
            </section>
          );
        })}
        {items.length === 0 ? (
          <section className="flex h-full w-full items-center justify-center bg-[var(--paper)] text-[var(--ink)]">
            <p className="font-display text-[22px]">카드를 준비하는 중…</p>
          </section>
        ) : null}
      </div>

      {/* top bar */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-20 pb-3 pt-[max(10px,env(safe-area-inset-top))] ${dark ? "bg-gradient-to-b from-black/30 to-transparent" : skyVideo ? "bg-gradient-to-b from-[#F5F9FF] via-[#F5F9FF]/85 to-transparent" : "bg-[var(--paper)]"}`}
      >
        <div className="pointer-events-auto flex items-center gap-1 px-2">
          <button type="button" onClick={onBack} aria-label="홈으로" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full active:bg-black/5">
            <svg width="22" height="22" viewBox="0 0 22 22">
              <path d="M14 4 L7 11 L14 18" stroke={fg} strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {/* 제목은 칸 없이 제목만 (11/24) */}
          <span className="min-w-0 flex-1 truncate pr-1 text-[16px] font-extrabold tracking-[-0.3px]" style={{ color: fg }}>
            {deck.title}
          </span>
          {deck.sample ? (
            <span className="shrink-0 text-[12px] font-semibold" style={{ color: dark ? "rgba(255,255,255,.8)" : "var(--muted)" }} title="설명을 위한 예시 자료예요. 화면 속 숫자는 가상이에요.">
              예시 자료 · 숫자는 가상
            </span>
          ) : null}
          <span className="mr-2 shrink-0 px-1 text-[14px] font-semibold tabular-nums" style={{ color: fg }}>
            {Math.max(1, lastConceptBefore)} / {deck.cards.length}
            {generating ? " · 만드는 중" : ""}
          </span>
        </div>
        {/* 조작 줄 (11/24 C안 확정, 작은 크기): 모션/텍스트 · 퀴즈 · 설정만. 나머지는 설정 시트로.
            교재 문제가 있는 덱에서만 시험문제 탭으로 가는 버튼이 하나 더 붙는다 (11/25) */}
        <div className="pointer-events-auto mt-1 flex items-center gap-1.5 px-3">
          {hasShorts ? (
            <div className={`flex shrink-0 rounded-[8px] p-[3px] ${dark ? "bg-white/20" : "bg-[var(--chip)]"}`} role="group" aria-label="보기 방식">
              {(["motion", "text"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={view === m}
                  onClick={() => view !== m && set({ mode: m }, m === "text" ? "텍스트 숏츠로 보기" : "같은 카드를 모션으로 보기 · 추가 비용 없음")}
                  className={`relative h-[26px] whitespace-nowrap rounded-[6px] before:absolute before:inset-x-0 before:inset-y-[-9px] before:content-[''] px-2.5 text-[13px] font-bold transition-colors ${
                    view === m ? (dark ? "bg-white text-[var(--ink)]" : "bg-[var(--ink)] text-white") : dark ? "text-white/80" : "text-[var(--muted)]"
                  }`}
                >
                  {m === "motion" ? "모션" : "텍스트"}
                </button>
              ))}
            </div>
          ) : null}
          {isStyleA ? (
            /* 스타일A 덱은 개념(여러 편이면 마지막 편)이 끝날 때마다 퀴즈가 나오므로 켜고 끄기만 한다 */
            <button
              type="button"
              className={ctl}
              onClick={() => set({ quizEvery: settings.quizEvery > 0 ? 0 : 3 }, settings.quizEvery > 0 ? "퀴즈 끔" : "개념이 끝날 때마다 퀴즈")}
              aria-pressed={settings.quizEvery > 0}
            >
              {settings.quizEvery > 0 ? "개념마다 퀴즈" : "퀴즈 끔"}
            </button>
          ) : (
            <button type="button" className={ctl} onClick={() => setQuizMenu((v) => !v)} aria-expanded={quizMenu}>
              {settings.quizEvery > 0 ? `퀴즈 ${settings.quizEvery}장마다` : "퀴즈 끔"} ▾
            </button>
          )}
          {hasExam ? (
            <button type="button" className={ctl} onClick={() => openExam(null)}>
              시험문제 {problems.length} →
            </button>
          ) : null}
          {/* 소리 켜기: 기본이 무음이라 설정 옆에 아이콘으로 바로 (11/26 확정 1안) */}
          <button
            type="button"
            className={`${ctl} ml-auto w-[30px] justify-center px-0 ${settings.sound ? (dark ? "!bg-white !text-[var(--ink)]" : "!bg-[var(--ink)] !text-white") : ""}`}
            onClick={() => {
              unlockAudio();
              set({ sound: !settings.sound, soundSet: true }, settings.sound ? "효과음 끔" : "효과음 켬");
            }}
            aria-pressed={settings.sound}
            aria-label={settings.sound ? "효과음 끄기" : "효과음 켜기"}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
              <path d="M2 6h3l4-3v10L5 10H2z" fill="currentColor" />
              {settings.sound ? (
                <path d="M11.5 5.5c1.2 1.4 1.2 3.6 0 5M13.5 3.8c2.2 2.4 2.2 6 0 8.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M11 5.5l4 5M15 5.5l-4 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              )}
            </svg>
          </button>
          <button type="button" className={ctl} onClick={() => setSettingsOpen(true)} aria-label="보기 설정">
            <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="2.4" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            설정
          </button>
        </div>
        {quizMenu ? (
          <div className="pointer-events-auto absolute left-3 top-[calc(100%-4px)] z-30 w-[220px] rounded-[16px] border-[2.5px] border-[var(--ink)] bg-white p-1.5">
            <p className="px-2 pb-1 pt-1 text-[13px] font-extrabold text-[var(--muted)]">퀴즈를 몇 장마다 낼까요?</p>
            {QUIZ_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  set({ quizEvery: n }, n ? `개념 ${n}장마다 퀴즈` : "퀴즈 끔");
                  setQuizMenu(false);
                }}
                className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-[14px] font-bold ${
                  settings.quizEvery === n ? "bg-[var(--ans)] text-[var(--ocean)]" : "text-[var(--ink)]"
                }`}
              >
                {n === 0 ? "퀴즈 없이 보기" : n === 1 ? "매 장마다" : `${n}장마다`}
                {settings.quizEvery === n ? <span>✓</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* bottom bar */}
      {current?.kind === "card" ? (
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-8 ${dark ? "bg-gradient-to-t from-black/30 to-transparent" : ""}`}
        >
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDetail(current.card)}
              className="relative flex h-[30px] items-center gap-1 rounded-[8px] border-2 border-[var(--ink)] bg-white px-2.5 before:absolute before:inset-[-7px] before:content-[''] text-[13px] font-bold text-[var(--ink)] shadow-[0_2px_0_var(--ink)] transition-transform active:translate-y-[2px] active:shadow-none"
            >
              해설 보기 <span className="font-extrabold">›</span>
            </button>
            {current.card.concept.pages ? (
              <span className="text-[13px] font-semibold" style={{ color: fg }}>{current.card.concept.pages}</span>
            ) : null}
            <span className="ml-auto text-[13px] font-medium" style={{ color: dark ? "#fff" : "var(--muted)" }}>
              {index === 0 ? <span className="animate-bob inline-block">↑ 넘기기</span> : "↑ 넘기기"}
              {isStyleA
                ? hasExam
                  ? " · ← 시험문제"
                  : ""
                : settings.quizEvery > 0
                ? (() => {
                    const left = settings.quizEvery - (lastConceptBefore % settings.quizEvery || settings.quizEvery);
                    return left ? ` · 퀴즈까지 ${left}장` : " · 다음은 퀴즈";
                  })()
                : ""}
            </span>
          </div>
          <div className={`mt-3 h-[3px] w-full overflow-hidden rounded-full ${dark ? "bg-white/25" : "bg-[var(--line)]"}`}>
            <div ref={progressBar} className={`h-full w-0 rounded-full ${dark ? "bg-white" : "bg-[var(--ocean)]"}`} />
          </div>
        </div>
      ) : null}

      </div>

      {/* 시험문제 탭 */}
      {hasExam ? (
        <div
          className="absolute inset-0 transition-transform duration-300 ease-out"
          style={{ transform: tab === "exam" ? "none" : "translateX(100%)" }}
          aria-hidden={tab !== "exam"}
        >
          <ExamTab deck={deck} active={tab === "exam"} filter={examFilter} onFilter={setExamFilter} settings={settings} onBack={() => setTab("concept")} onDeckChange={onDeckChange} />
        </div>
      ) : null}

      <Toast text={toast} />

      {/* explanation sheet */}
      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.concept.term}>
        {detail ? (
          <div className="space-y-4 pb-2">
            <p className="rounded-[16px] border-[2.5px] border-[var(--ink)] bg-white px-4 py-3 text-[15px] font-bold leading-relaxed text-[var(--ink)]">{detail.concept.definition}</p>
            <p className="text-[15px] font-medium leading-[1.7] text-[var(--ink)]">{detail.concept.explanation}</p>
            {detail.concept.keyPoints.length ? (
              <div>
                <p className="mb-1.5 text-[13px] font-extrabold text-[var(--muted)]">시험 포인트</p>
                <ul className="space-y-1.5">
                  {detail.concept.keyPoints.map((k, i) => (
                    <li key={i} className="flex gap-2 text-[14px] font-semibold leading-relaxed text-[var(--ink)]">
                      <span className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[12px] font-extrabold text-white">{i + 1}</span>
                      {k}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {detail.concept.example ? (
              <div className="rounded-[16px] bg-[var(--paper)] px-4 py-3">
                <p className="text-[13px] font-extrabold text-[var(--muted)]">예시</p>
                <p className="mt-1 text-[14px] font-semibold leading-relaxed text-[var(--ink)]">{detail.concept.example}</p>
              </div>
            ) : null}
            {detail.fallback ? (
              <p className="rounded-[16px] bg-[var(--paper)] px-3.5 py-2.5 text-[13px] font-bold leading-relaxed text-[var(--ink)]">
                AI 카드가 검사를 통과하지 못해 기본 카드로 보여 주고 있어요. 아래 버튼으로 다시 만들 수 있어요.
              </p>
            ) : null}
            <p className="text-[13px] font-semibold text-[var(--muted)]">
              출처: {deck.source}
              {deck.sample
                ? " · 설명을 위해 만든 예시라 화면 속 숫자는 가상이에요."
                : `${detail.concept.pages ? ` · ${detail.concept.pages}` : ""} · AI가 만든 설명이라 원문과 함께 확인하세요.`}
            </p>
            {!deck.sample ? (
              <button
                type="button"
                onClick={() => {
                  onRetryCard(detail.id);
                  setDetail(null);
                  setToast("이 카드를 새로 만들어요");
                }}
                className="w-full rounded-[16px] border-[2.5px] border-[var(--ink)] bg-white py-3 text-[14px] font-bold text-[var(--ink)]"
              >
                이 카드 다시 만들기
              </button>
            ) : null}
          </div>
        ) : null}
      </Sheet>

      {/* 보기 설정 시트 (11/24 C안) */}
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="보기 설정">
        <div className="pb-2">
          {(
            [
              ["재생 속도", null],
              ["소리", "sound"],
              ["목소리로 읽어 주기", "voice"],
              ["자막", "captions"],
              ["다 보면 다음 카드로", "autoNext"],
              ["순서 섞기", "shuffle"],
              ["틀린 문제 3장 뒤 다시", "retryWrong"],
            ] as const
          )
            // 목소리는 스타일A 카드에서만, 기기에 음성이 있을 때만 (무료 기기 음성)
            .filter(([, key]) => key !== "voice" || (isStyleA && canSpeak()))
            .map(([label, key]) => (
            <div key={label} className="flex items-center justify-between border-t-[1.5px] border-[var(--ink)]/10 py-3 first:border-t-0">
              <span className="text-[15px] font-bold text-[var(--ink)]">{label}</span>
              {key === null ? (
                <button
                  type="button"
                  className="text-[15px] font-extrabold text-[var(--ocean)]"
                  onClick={() => {
                    const next = SPEEDS[(SPEEDS.indexOf(settings.speed) + 1) % SPEEDS.length] ?? 1;
                    set({ speed: next });
                  }}
                >
                  {settings.speed}배 ›
                </button>
              ) : (
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!settings[key]}
                  aria-label={label}
                  onClick={() => {
                    if (key === "sound") unlockAudio();
                    if (key === "voice" && !settings.voice) primeVoice();
                    set({ [key]: !settings[key], ...(key === "sound" ? { soundSet: true } : {}) } as Partial<Settings>);
                  }}
                  className={`relative h-[26px] w-[44px] rounded-full transition-colors ${settings[key] ? "bg-[var(--ocean)]" : "bg-[var(--line)]"}`}
                >
                  <span className={`absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all ${settings[key] ? "left-[21px]" : "left-[3px]"}`} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              setSettingsOpen(false);
              setTimeout(() => setNotes(true), 260);
            }}
            className="flex w-full items-center justify-between border-t-[1.5px] border-[var(--ink)]/10 py-3"
          >
            <span className="text-[15px] font-bold text-[var(--ink)]">오답노트</span>
            <span className="text-[15px] font-extrabold text-[var(--ocean)]">{wrongCards.length}개 ›</span>
          </button>
        </div>
      </Sheet>

      {/* wrong-answer notes */}
      <Sheet open={notes} onClose={() => setNotes(false)} title={`오답노트 ${wrongCards.length}개`}>
        {wrongCards.length === 0 ? (
          <p className="py-6 text-center text-[14px] font-semibold text-[var(--muted)]">아직 틀린 문제가 없어요.</p>
        ) : (
          <div className="space-y-3 pb-2">
            {wrongCards.map((c) => {
              const q = quizOf(c)!;
              return (
              <div key={c.id} className="rounded-[16px] border-[2.5px] border-[var(--ink)] p-4">
                <p className="text-[13px] font-extrabold text-[var(--ocean)]">{c.concept.term}</p>
                <p className="mt-1 text-[15px] font-bold leading-snug text-[var(--ink)]">{q.question}</p>
                <p className="mt-2 text-[14px] font-extrabold text-[var(--ans-line)]">✓ {q.options[q.answer]}</p>
                {q.explanation ? <p className="mt-1 text-[13px] font-medium leading-relaxed text-[var(--muted)]">{q.explanation}</p> : null}
                <button
                  type="button"
                  onClick={() => {
                    const at = items.findIndex((it) => it.kind === "card" && it.card.id === c.id);
                    setNotes(false);
                    if (at >= 0) setTimeout(() => scrollTo(at), 260);
                  }}
                  className="mt-2 text-[13px] font-extrabold text-[var(--blue)]"
                >
                  카드 다시 보기 →
                </button>
              </div>
              );
            })}
          </div>
        )}
      </Sheet>
    </div>
  );
}
