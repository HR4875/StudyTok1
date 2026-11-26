"use client";

import type { Deck, RenderMode } from "./schema";

const DECKS_KEY = "studytok.decks.v1";
const SETTINGS_KEY = "studytok.settings.v1";

export interface Settings {
  quizEvery: number; // 0 = off
  speed: number; // playback rate
  sound: boolean;
  /** 사용자가 직접 소리를 켜거나 끈 적이 있는지. 없으면 기본값(꺼짐)을 따른다 (11/26) */
  soundSet?: boolean;
  autoNext: boolean; // false = loop each card
  captions: boolean;
  shuffle: boolean;
  retryWrong: boolean;
  cardCount: number; // concepts per upload
  mode: RenderMode; // text = 기본(싼 버전), motion = 모션그래픽
  /** 간격 복습 1·3·7일 (11/26 기획 제안, 기본 켜짐) */
  spacedReview: boolean;
  /** 간격 복습 첫 안내를 본 적 있는지 */
  reviewIntroSeen?: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  quizEvery: 3,
  speed: 1,
  sound: false, // 기본 무음 + 자막 켜짐 (11/26 기획 피드백 확정): 지하철·도서관에서 갑자기 소리 나지 않게
  autoNext: false,
  captions: true,
  shuffle: false,
  retryWrong: true,
  cardCount: 8,
  mode: "text",
  spacedReview: true,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadDecks(): Deck[] {
  const decks = read<Deck[]>(DECKS_KEY, []);
  return Array.isArray(decks) ? decks.filter((d) => d && Array.isArray(d.cards)) : [];
}

export function saveDeck(deck: Deck) {
  if (deck.sample) return;
  const decks = loadDecks().filter((d) => d.id !== deck.id);
  decks.unshift(deck);
  // keep storage bounded: drop oldest decks if the quota is hit
  while (!write(DECKS_KEY, decks) && decks.length > 1) decks.pop();
}

export function deleteDeck(id: string) {
  forgetDeck(id);
  write(
    DECKS_KEY,
    loadDecks().filter((d) => d.id !== id),
  );
}

export function loadSettings(): Settings {
  const s = { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(SETTINGS_KEY, {}) };
  if (s.mode !== "text" && s.mode !== "motion") s.mode = DEFAULT_SETTINGS.mode;
  // 예전 기본값(켜짐)이 저장돼 있던 사람도, 직접 고른 적이 없으면 무음으로 시작
  if (!s.soundSet) s.sound = false;
  return s;
}

/** 같은 자료로 이미 만든 덱 (key가 같고 실패 카드가 없을 때만) */
export function findDeckByKey(key: string): Deck | null {
  return loadDecks().find((d) => d.key === key && d.cards.length > 0 && d.cards.every((c) => c.status === "ready")) ?? null;
}

export function saveSettings(s: Settings) {
  write(SETTINGS_KEY, s);
}

/* ---------- 이어보기: 덱별 마지막으로 본 카드 ---------- */

const PROGRESS_KEY = "studytok.progress.v1";

export interface DeckProgress {
  /** 피드 항목 key (c-카드id, q-카드id …) */
  key: string;
  /** 몇 번째 개념까지 봤는지 (1부터) */
  n: number;
  total: number;
  at: number;
  /** 완주 화면까지 갔으면 true → 홈 이어보기에서 뺀다 */
  done?: boolean;
}

export function loadProgressAll(): Record<string, DeckProgress> {
  const all = read<Record<string, DeckProgress>>(PROGRESS_KEY, {});
  return all && typeof all === "object" ? all : {};
}

export function loadProgress(deckId: string): DeckProgress | null {
  return loadProgressAll()[deckId] ?? null;
}

export function saveProgress(deckId: string, p: DeckProgress) {
  const all = loadProgressAll();
  all[deckId] = p;
  // 오래된 것부터 지워 50개까지만
  const ids = Object.keys(all).sort((a, b) => all[b].at - all[a].at);
  for (const id of ids.slice(50)) delete all[id];
  write(PROGRESS_KEY, all);
}

export function clearProgress(deckId: string) {
  const all = loadProgressAll();
  delete all[deckId];
  write(PROGRESS_KEY, all);
}

/* ---------- 간격 복습 1·3·7일 ---------- */

const REVIEW_KEY = "studytok.review.v1";
const CLOCK_KEY = "studytok.clock.v1";
const DAY = 86_400_000;
/** 맞힐 때마다 다음 간격: 1일 → 3일 → 7일 → 졸업 */
export const REVIEW_STEPS = [1, 3, 7] as const;

export interface ReviewEntry {
  deckId: string;
  cardId: string;
  /** 지금 기다리는 간격 단계 (1 = 1일, 2 = 3일, 3 = 7일). 3단계를 맞히면 졸업 */
  step: number;
  /** 이 시각(그날 0시)부터 복습 대상 */
  due: number;
  /** 졸업하면 더 나오지 않는다 */
  graduated?: boolean;
}

/** 시연용 가상 날짜: 며칠 앞으로 당겨 보기 */
export function clockOffsetDays(): number {
  const n = read<number>(CLOCK_KEY, 0);
  return typeof n === "number" && n > 0 ? n : 0;
}
export function setClockOffsetDays(n: number) {
  write(CLOCK_KEY, Math.max(0, Math.round(n)));
}
export const reviewNow = () => Date.now() + clockOffsetDays() * DAY;

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
/** 오늘 기준 n일 뒤 0시 (하루 중 언제 풀었든 다음 날 아침이면 복습) */
const dayAfter = (now: number, n: number) => startOfDay(now) + n * DAY + 2 * 3_600_000; // 2시간 여유: 서머타임 없어도 안전하게

export function loadReviews(): Record<string, ReviewEntry> {
  const all = read<Record<string, ReviewEntry>>(REVIEW_KEY, {});
  return all && typeof all === "object" ? all : {};
}

/** 지금 복습할 퀴즈 (오래 기다린 것부터) */
export function dueReviews(deckId?: string): ReviewEntry[] {
  const now = reviewNow();
  return Object.values(loadReviews())
    .filter((r) => !r.graduated && r.due <= now && (!deckId || r.deckId === deckId))
    .sort((a, b) => a.due - b.due);
}

export function reviewCount(): number {
  return Object.values(loadReviews()).filter((r) => !r.graduated).length;
}

/**
 * 퀴즈 하나를 푼 결과를 복습 일정에 반영한다.
 * - 처음 푼 퀴즈: 맞든 틀리든 1일 뒤
 * - 복습 퀴즈를 맞힘: 1일 → 3일 → 7일 → 졸업
 * - 틀림: 언제든 1일부터 다시
 */
export function recordReview(deckId: string, cardId: string, correct: boolean, isReview: boolean): ReviewEntry {
  const all = loadReviews();
  const now = reviewNow();
  const prev = all[cardId];
  let next: ReviewEntry;
  if (!correct) next = { deckId: prev?.deckId ?? deckId, cardId, step: 1, due: dayAfter(now, REVIEW_STEPS[0]) };
  else if (!prev) next = { deckId, cardId, step: 1, due: dayAfter(now, REVIEW_STEPS[0]) };
  else if (isReview && prev.due <= now) {
    next = prev.step >= REVIEW_STEPS.length ? { ...prev, graduated: true } : { ...prev, step: prev.step + 1, due: dayAfter(now, REVIEW_STEPS[prev.step]) };
  } else next = prev; // 아직 복습일이 아닌데 다시 맞힘 → 일정 그대로
  all[cardId] = next;
  write(REVIEW_KEY, all);
  return next;
}

/** 덱을 지우면 그 덱의 복습·이어보기도 지운다 */
export function forgetDeck(deckId: string) {
  const all = loadReviews();
  for (const [k, r] of Object.entries(all)) if (r.deckId === deckId) delete all[k];
  write(REVIEW_KEY, all);
  clearProgress(deckId);
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
