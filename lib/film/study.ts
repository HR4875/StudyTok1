"use client";
// 공부 기록: 이어보기(보던 편), 간격 복습(기본 1·3·7일, 횟수는 사용자가 고른다), 시연용 가상 날짜. 기존 앱(PR 9)의 규칙을 그대로 옮겼다.
// 이 기기의 localStorage에만 둔다. 저장이 막힌 브라우저에서도 이번에 연 동안은 그대로 동작한다.
import { useSyncExternalStore } from "react";

/** 복습 간격(일): 처음 풀고 1일 뒤, 맞히면 3일 뒤, 또 맞히면 7일 뒤, 14일 뒤. 고른 횟수만큼 맞히면 졸업 */
export const REVIEW_STEPS = [1, 3, 7, 14] as const;
/** 복습 횟수 고르기 (11/27 기획): 1회(1일) · 2회(1·3일) · 3회(1·3·7일, 기본) · 4회(1·3·7·14일) */
export const REVIEW_COUNTS = [1, 2, 3, 4] as const;
export const DEFAULT_REVIEW_COUNT = 3;

export interface Progress {
  k: number;
  at: number;
  /** 끝 화면까지 봤다 */
  done?: boolean;
}
export interface Review {
  sid: string;
  k: number;
  /** REVIEW_STEPS의 몇 번째 간격을 기다리는 중인지 (0부터) */
  step: number;
  due: number;
  graduated?: boolean;
}
interface Study {
  progress: Record<string, Progress>;
  review: Record<string, Review>;
  /** 간격 복습 켜짐 (기본 켜짐) */
  spaced: boolean;
  /** 첫 복습 안내를 봤다 */
  intro: boolean;
  /** 시연용 가상 날짜: 오늘에서 며칠 뒤로 보냈는지 */
  clock: number;
  /** 복습 횟수 (1~4, 기본 3 = 1·3·7일) */
  count: number;
}

const KEY = "film.study";
const SHORT_KEY = /^[a-z0-9]{1,24}-\d{1,3}$/;
const SID = /^[a-z0-9]{1,24}$/;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function clean(v: unknown): Study {
  const out: Study = { progress: {}, review: {}, spaced: true, intro: false, clock: 0, count: DEFAULT_REVIEW_COUNT };
  if (!isObj(v)) return out;
  if (isObj(v.progress))
    for (const [sid, p] of Object.entries(v.progress)) if (SID.test(sid) && isObj(p) && n(p.k) >= 1) out.progress[sid] = { k: Math.floor(n(p.k)), at: n(p.at), done: p.done === true || undefined };
  if (isObj(v.review))
    for (const [key, r] of Object.entries(v.review))
      if (SHORT_KEY.test(key) && isObj(r) && typeof r.sid === "string") out.review[key] = { sid: r.sid, k: Math.floor(n(r.k)), step: Math.min(REVIEW_STEPS.length - 1, Math.max(0, Math.floor(n(r.step)))), due: n(r.due), graduated: r.graduated === true || undefined };
  out.spaced = v.spaced !== false;
  out.intro = v.intro === true;
  out.clock = Math.min(60, Math.max(0, Math.floor(n(v.clock))));
  const c = Math.floor(n(v.count));
  out.count = c >= 1 && c <= REVIEW_STEPS.length ? c : DEFAULT_REVIEW_COUNT;
  return out;
}

let st: Study | null = null;
let version = 0;
const listeners = new Set<() => void>();
function load(): Study {
  if (st) return st;
  let raw: unknown = null;
  try {
    const s = window.localStorage.getItem(KEY);
    raw = s ? (JSON.parse(s) as unknown) : null;
  } catch {
    raw = null;
  }
  st = clean(raw);
  try {
    window.addEventListener("storage", (e) => {
      if (e.key !== KEY) return;
      st = null;
      version++;
      listeners.forEach((fn) => fn());
    });
  } catch {
    /* 창이 없는 곳 */
  }
  return st;
}
function save(patch: Partial<Study>): void {
  st = { ...load(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(st));
  } catch {
    /* 저장이 막혔다: 이번에 연 동안만 기억한다 */
  }
  version++;
  listeners.forEach((fn) => fn());
}

export function useStudy(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => version,
    () => 0,
  );
}

// ---------- 시계 (시연용 가상 날짜) ----------
const DAY = 86400000;
export const clockDays = (): number => load().clock;
export const now = (): number => Date.now() + clockDays() * DAY;
export function setClockDays(d: number): void {
  save({ clock: Math.min(60, Math.max(0, Math.floor(d))) });
}
/** n일 뒤 새벽 2시 (그날 아침에 열면 바로 나오게) */
function dayAfter(t: number, days: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime() + days * DAY + 2 * 3600000;
}

// ---------- 이어보기 ----------
export const progressOf = (sid: string): Progress | undefined => load().progress[sid];
export function saveProgress(sid: string, k: number): void {
  const p = load().progress[sid];
  if (p && p.k === k && !p.done) return;
  save({ progress: { ...load().progress, [sid]: { k, at: Date.now() } } });
}
export function finishProgress(sid: string): void {
  const p = load().progress[sid];
  if (!p || p.done) return;
  save({ progress: { ...load().progress, [sid]: { ...p, done: true, at: Date.now() } } });
}
/** 가장 최근에 보다 만 시리즈 (끝까지 본 것은 뺀다) */
export function lastProgress(ok: (sid: string, k: number) => boolean): { sid: string; k: number } | null {
  const all = Object.entries(load().progress)
    .filter(([sid, p]) => !p.done && ok(sid, p.k))
    .sort((a, b) => b[1].at - a[1].at);
  return all.length ? { sid: all[0][0], k: all[0][1].k } : null;
}

// ---------- 간격 복습 ----------
export const spacedOn = (): boolean => load().spaced;
export const setSpaced = (on: boolean): void => save({ spaced: on });
/** 복습 횟수 (1~4) */
export const reviewCount = (): number => load().count;
/** 고른 횟수의 간격들 (예: [1, 3, 7]) */
export const reviewSteps = (): number[] => REVIEW_STEPS.slice(0, reviewCount());
/** "1·3·7일" 같은 표시 문구 */
export const stepsLabel = (count = reviewCount()): string => REVIEW_STEPS.slice(0, count).join("·") + "일";
/** 퀴즈를 푼 뒤 안내 문구: 맞힌 문제가 언제 다시 나오는지 */
export const reviewNote = (): string => {
  const rest = reviewSteps().slice(1);
  return rest.length ? `맞힌 문제는 ${rest.map((d) => `${d}일`).join("·")} 뒤에 한 번 더, 틀린 문제는 내일 다시 나와요.` : "맞힌 문제는 내일 한 번 더, 틀린 문제는 내일 다시 나와요.";
};
/** 복습 횟수 바꾸기. 줄이면 이미 그만큼 맞힌 퀴즈는 졸업 */
export function setReviewCount(c: number): void {
  const count = Math.min(REVIEW_STEPS.length, Math.max(1, Math.floor(c)));
  const review = { ...load().review };
  for (const [key, r] of Object.entries(review)) if (!r.graduated && r.step >= count) review[key] = { ...r, graduated: true };
  save({ count, review });
}
export const introSeen = (): boolean => load().intro;
export const seeIntro = (): void => {
  if (!load().intro) save({ intro: true });
};

/**
 * 퀴즈 하나를 푼 결과를 복습 일정에 넣는다 (PR 9 규칙).
 * 틀리면 1일 간격부터 다시. 처음 풀면 1일 뒤. 복습할 날에 맞히면 다음 간격, 고른 횟수만큼 맞히면 졸업. 그 밖에는 그대로.
 */
export function recordReview(sid: string, k: number, correct: boolean, isReview: boolean): void {
  if (!spacedOn()) return;
  const key = `${sid}-${k}`;
  const r = load().review[key];
  const t = now();
  let next: Review | null = null;
  if (!correct) next = { sid, k, step: 0, due: dayAfter(t, REVIEW_STEPS[0]) };
  else if (!r) next = { sid, k, step: 0, due: dayAfter(t, REVIEW_STEPS[0]) };
  else if (isReview && !r.graduated && r.due <= t) {
    const step = r.step + 1;
    next = step >= reviewCount() ? { ...r, graduated: true } : { sid, k, step, due: dayAfter(t, REVIEW_STEPS[step]) };
  }
  if (next) save({ review: { ...load().review, [key]: next } });
}
/** 오늘 복습할 퀴즈 (sid를 주면 그 시리즈만). 오래 기다린 것부터 */
export function dueReviews(sid?: string): Review[] {
  if (!spacedOn()) return [];
  const t = now();
  return Object.values(load().review)
    .filter((r) => !r.graduated && r.due <= t && (!sid || r.sid === sid))
    .sort((a, b) => a.due - b.due);
}
/** 기다리는 복습 (오늘이 아닌 것 포함, 졸업 제외) */
export const waitingReviews = (): number => Object.values(load().review).filter((r) => !r.graduated).length;
export const reviewOf = (sid: string, k: number): Review | undefined => load().review[`${sid}-${k}`];
/** 디버그 창용: 기록 전부 */
export const studyDump = (): Study => load();
