"use client";
// 모션 쇼츠 화면의 상태: 내장 시리즈 + 이 기기에 남기는 것(설정, 본 기록, 내가 만든 시리즈와 편).
// 아직 로그인과 서버 저장이 없어서 localStorage에 둔다. 저장이 막힌 브라우저(사생활 보호 창 등)에서도 화면은 그대로 동작한다.
import { useSyncExternalStore } from "react";
import { BUILT_SERIES, SAMPLES, type BuiltShort } from "./library";
import { briefOf, checkScript, parsePlan, usablePlan, type Checked, type SeriesPlan } from "./plan";
import { SKINS } from "./skins";

export const BRAND = "StudyTok";
export const SPEEDS: readonly number[] = [1, 1.1, 1.25, 1.5];

export interface Prefs {
  /** 디자인 id (lib/film/skins.ts) */
  skin: string;
  speed: number;
  /** 소리. 기본은 꺼짐 */
  sound: boolean;
}

/** 한 편을 본 기록 */
export interface Seen {
  done?: boolean;
  /** 영상 속 질문을 맞혔는지 (질문이 없거나 답하지 않았으면 null) */
  ask?: boolean | null;
  /** 끝난 뒤 확인 문제를 맞혔는지, 문제 순서대로 */
  quiz?: boolean[];
  at?: number;
}

/** 내가 만든 시리즈 (계획 한 번) */
export interface MadeSeries {
  id: string;
  kicker: string;
  planText: string;
  secs: number;
  /** 계획이 길어 일부 편이 빠졌다 */
  cut: boolean;
  /** 계획에 든 AI 비용(달러). 예시 모드에서는 0 */
  usd: number;
  at: number;
}

/** 내가 만든 한 편 */
export interface MadeShort {
  raw: string;
  secs: number;
  calls: number;
  fix: "" | "patch" | "rewrite";
  /** 남은 자동 점검 오류 수 */
  errs: number;
  /** 이 편에 든 AI 비용(달러). 예시 모드에서는 0 */
  usd: number;
  /** 대본을 쓴 모델 id. 예시 모드에서는 "mock" */
  model: string;
  at: number;
}

export type ShortEntry =
  | { from: "built"; raw: string; cost: BuiltShort["cost"] }
  | { from: "mine"; raw: string; made: MadeShort }
  | { from: "ex"; raw: string; label: string; kind: string };

export interface Series {
  id: string;
  /** built: 내장, mine: 내가 만든 것, ex: 한 편짜리 맛보기 묶음 */
  kind: "built" | "mine" | "ex";
  kicker: string;
  title: string;
  /** ex 말고는 항상 있다 */
  plan: SeriesPlan | null;
  planText: string;
  /** 계획 비용을 편 수로 나눈 값(달러) */
  planShare: number;
  cut: boolean;
  /** 편 번호(1부터) → 이미 있는 대본 */
  shorts: Record<number, ShortEntry>;
}

/** 읽고 자동 점검까지 마친 한 편 */
export interface LoadedShort extends Checked {
  entry: ShortEntry;
}

// ---------- 저장 ----------
const PREFIX = "film.";
const load = <T>(key: string, fallback: T): T => {
  try {
    const v = window.localStorage.getItem(PREFIX + key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* 저장이 막힌 브라우저: 이번에 연 동안만 기억한다 */
  }
};

interface State {
  prefs: Prefs;
  seen: Record<string, Seen>;
  made: { seq: number; series: MadeSeries[]; shorts: Record<string, MadeShort> };
  series: Map<string, Series>;
}

let state: State | null = null;
let version = 0;
const listeners = new Set<() => void>();
const parsed = new Map<string, LoadedShort>();
const keyOf = (sid: string, k: number) => `${sid}-${k}`;
const emit = () => {
  version++;
  listeners.forEach((fn) => fn());
};

function mineSeries(d: MadeSeries, shorts: Record<string, MadeShort>): Series {
  const plan = usablePlan(parsePlan(d.planText));
  const out: Series = { id: d.id, kind: "mine", kicker: d.kicker, title: plan.series, plan, planText: d.planText, planShare: plan.shorts.length ? d.usd / plan.shorts.length : 0, cut: d.cut, shorts: {} };
  for (let k = 1; k <= plan.shorts.length; k++) {
    const m = shorts[keyOf(d.id, k)];
    if (m && typeof m.raw === "string") out.shorts[k] = { from: "mine", raw: m.raw, made: m };
  }
  return out;
}

function init(): State {
  if (state) return state;
  const hasWindow = typeof window !== "undefined";
  const prefs: Prefs = { skin: "paper", speed: 1.1, sound: false, ...(hasWindow ? load<Partial<Prefs>>("prefs", {}) : {}) };
  if (!SKINS[prefs.skin]) prefs.skin = "paper";
  if (!SPEEDS.includes(prefs.speed)) prefs.speed = 1.1;
  prefs.sound = prefs.sound === true;
  const seen = hasWindow ? load<Record<string, Seen>>("seen", {}) : {};
  const stored = hasWindow ? load<Partial<State["made"]>>("made", {}) : {};
  const made = { seq: Number(stored.seq) || 0, series: Array.isArray(stored.series) ? stored.series : [], shorts: stored.shorts && typeof stored.shorts === "object" ? stored.shorts : {} };

  const series = new Map<string, Series>();
  for (const b of BUILT_SERIES) {
    const plan = usablePlan(parsePlan(b.planText));
    const shorts: Record<number, ShortEntry> = {};
    for (const [k, v] of Object.entries(b.shorts)) shorts[Number(k)] = { from: "built", raw: v.raw, cost: v.cost };
    // 내장 시리즈에서 아직 없던 편을 이 기기에서 만들었으면 이어 붙인다
    for (let k = 1; k <= plan.shorts.length; k++) {
      const m = made.shorts[keyOf(b.id, k)];
      if (!shorts[k] && m && typeof m.raw === "string") shorts[k] = { from: "mine", raw: m.raw, made: m };
    }
    series.set(b.id, { id: b.id, kind: "built", kicker: b.kicker, title: plan.series, plan, planText: b.planText, planShare: b.planShare, cut: false, shorts });
  }
  const ex: Series = { id: "ex", kind: "ex", kicker: "맛보기", title: "한 편짜리 맛보기", plan: null, planText: "", planShare: 0, cut: false, shorts: {} };
  SAMPLES.forEach((x, i) => {
    ex.shorts[i + 1] = { from: "ex", raw: x.raw, label: x.label, kind: x.kind };
  });
  series.set("ex", ex);
  for (const d of made.series) {
    if (!d || typeof d.id !== "string" || typeof d.planText !== "string" || series.has(d.id)) continue;
    const s = mineSeries(d, made.shorts);
    if (s.plan && s.plan.shorts.length) series.set(s.id, s);
  }
  state = { prefs, seen, made, series };
  return state;
}

// ---------- 구독 ----------
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
/** 저장된 것이 바뀔 때마다 다시 그리게 하는 훅. 값 자체는 아래 함수들로 읽는다. */
export function useFilmStore(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
}

// ---------- 설정과 본 기록 ----------
export const getPrefs = (): Prefs => init().prefs;
export function setPrefs(patch: Partial<Prefs>): void {
  const s = init();
  s.prefs = { ...s.prefs, ...patch };
  save("prefs", s.prefs);
  emit();
}
export const seenOf = (sid: string, k: number): Seen | undefined => init().seen[keyOf(sid, k)];
export function markSeen(sid: string, k: number, patch: Seen): void {
  const s = init();
  s.seen = { ...s.seen, [keyOf(sid, k)]: { ...s.seen[keyOf(sid, k)], ...patch } };
  save("seen", s.seen);
  emit();
}

// ---------- 시리즈와 편 ----------
/** built: 내장 시리즈(정해진 순서), mine: 내가 만든 시리즈(새것부터) */
export function listSeries(kind: "built" | "mine"): Series[] {
  const all = [...init().series.values()].filter((s) => s.kind === kind);
  return kind === "mine" ? all.reverse() : all;
}
export const getSeries = (id: string): Series | null => init().series.get(id) ?? null;
/** 맛보기 목록 (홈 화면용) */
export const sampleList = (): { k: number; label: string; kind: string }[] => SAMPLES.map((x, i) => ({ k: i + 1, label: x.label, kind: x.kind }));
/** 계획된 편 수 (맛보기 묶음은 들어 있는 편 수) */
export const totalOf = (s: Series): number => (s.plan ? s.plan.shorts.length : Object.keys(s.shorts).length);
export const entryOf = (sid: string, k: number): ShortEntry | null => getSeries(sid)?.shorts[k] ?? null;
/** 이미 만들어져 볼 수 있는 편 번호 */
export function madeKs(s: Series): number[] {
  const out: number[] = [];
  for (let k = 1; k <= totalOf(s); k++) if (s.shorts[k]) out.push(k);
  return out;
}

/** 한 편의 대본을 읽고 자동 점검한 결과 (한 번 읽으면 기억해 둔다). 없는 편이면 null */
export function loadShort(sid: string, k: number): LoadedShort | null {
  const s = getSeries(sid);
  const e = s?.shorts[k];
  if (!s || !e) return null;
  const key = keyOf(sid, k);
  const hit = parsed.get(key);
  if (hit && hit.raw === e.raw) return hit;
  const c = checkScript(e.raw, s.plan && s.plan.shorts[k - 1] ? briefOf(s.plan, k) : null);
  const sh: LoadedShort = { ...c, entry: e };
  parsed.set(key, sh);
  return sh;
}

export function titleOf(sid: string, k: number): string {
  const s = getSeries(sid);
  const planned = s?.plan?.shorts[k - 1]?.title;
  if (planned) return planned;
  const e = s?.shorts[k];
  if (e && e.from === "ex") return e.label;
  return loadShort(sid, k)?.script.title || `${k}편`;
}

/** 새 시리즈(계획)를 저장하고 그 id를 돌려준다 */
export function addSeries(def: Omit<MadeSeries, "id" | "at">): string {
  const s = init();
  let id = "";
  do {
    s.made.seq += 1;
    id = "m" + s.made.seq;
  } while (s.series.has(id));
  const d: MadeSeries = { ...def, id, at: Date.now() };
  s.made.series = [...s.made.series, d];
  s.series.set(id, mineSeries(d, s.made.shorts));
  save("made", s.made);
  emit();
  return id;
}

/** 만든 한 편을 저장한다. 내장 시리즈의 아직 없는 편을 만든 경우도 여기에 남는다. */
export function addShort(sid: string, k: number, rec: Omit<MadeShort, "at">): void {
  const s = init();
  const ser = s.series.get(sid);
  if (!ser) return;
  const m: MadeShort = { ...rec, at: Date.now() };
  s.made.shorts = { ...s.made.shorts, [keyOf(sid, k)]: m };
  s.series.set(sid, { ...ser, shorts: { ...ser.shorts, [k]: { from: "mine", raw: m.raw, made: m } } });
  save("made", s.made);
  emit();
}

/** 내가 만든 시리즈와 그 편들을 지운다 */
export function removeSeries(id: string): void {
  const s = init();
  const ser = s.series.get(id);
  if (!ser || ser.kind !== "mine") return;
  s.made.series = s.made.series.filter((x) => x.id !== id);
  const shorts: Record<string, MadeShort> = {};
  for (const [key, v] of Object.entries(s.made.shorts)) if (!key.startsWith(id + "-")) shorts[key] = v;
  s.made.shorts = shorts;
  s.series.delete(id);
  save("made", s.made);
  emit();
}
