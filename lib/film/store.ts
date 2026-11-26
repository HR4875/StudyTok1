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
  | { from: "built"; raw: string; cost: BuiltShort["cost"]; edited?: boolean }
  | { from: "mine"; raw: string; made: MadeShort }
  | { from: "ex"; raw: string; label: string; kind: string; note?: string };

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
// 탭을 여러 개 열어도 서로 덮어쓰지 않게 한다: 바꿀 때마다 저장된 것을 다시 읽어 거기에 더하고, 다른 탭이 바꾼 것은 바로 따라간다.
const PREFIX = "film.";
type Key = "prefs" | "seen" | "made";
const KEYS: readonly Key[] = ["prefs", "seen", "made"];
/** 저장하지 못해 이 창의 기억이 저장소보다 앞서 있는 것 (저장이 막혔거나 꽉 찼을 때). 그동안은 저장소를 다시 읽지 않는다. */
const ahead: Record<Key, boolean> = { prefs: false, seen: false, made: false };

/** 저장된 값. 없거나 깨졌으면 null, 저장소를 읽지 못하면(저장이 막힌 브라우저) undefined */
function read(key: Key): unknown {
  let v: string | null;
  try {
    v = window.localStorage.getItem(PREFIX + key);
  } catch {
    return undefined;
  }
  if (v == null) return null;
  try {
    return JSON.parse(v) as unknown;
  } catch {
    return null;
  }
}
function write(key: Key, value: unknown): boolean {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    ahead[key] = false;
    return true;
  } catch {
    // 저장이 막혔거나 꽉 찼다: 이번에 연 동안만 기억한다. 만든 것이면 화면에서 알린다 (unsavedMade)
    ahead[key] = true;
    return false;
  }
}

// 저장소의 값은 모양을 믿지 않는다. 다른 판이 남긴 것, 손으로 고친 것, 깨진 것이 들어 있어도 화면은 떠야 한다.
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const SERIES_ID = /^[a-z0-9]{1,24}$/;
const SHORT_KEY = /^[a-z0-9]{1,24}-\d{1,3}$/;

function cleanPrefs(v: unknown): Prefs {
  const o = isObj(v) ? v : {};
  return {
    skin: typeof o.skin === "string" && SKINS[o.skin] ? o.skin : "paper",
    speed: typeof o.speed === "number" && SPEEDS.includes(o.speed) ? o.speed : 1.1,
    sound: o.sound === true,
  };
}

function cleanSeen(v: unknown): Record<string, Seen> {
  const out: Record<string, Seen> = {};
  if (!isObj(v)) return out;
  for (const [key, x] of Object.entries(v)) {
    if (!SHORT_KEY.test(key) || !isObj(x)) continue;
    const s: Seen = {};
    const ask = x.ask;
    if (x.done === true) s.done = true;
    if (typeof ask === "boolean" || ask === null) s.ask = ask;
    if (Array.isArray(x.quiz)) s.quiz = x.quiz.slice(0, 8).map((b) => b === true);
    if (typeof x.at === "number" && Number.isFinite(x.at)) s.at = x.at;
    out[key] = s;
  }
  return out;
}

interface Made {
  series: MadeSeries[];
  shorts: Record<string, MadeShort>;
}

function cleanMade(v: unknown): Made {
  const out: Made = { series: [], shorts: {} };
  if (!isObj(v)) return out;
  const ids = new Set<string>();
  for (const d of Array.isArray(v.series) ? (v.series as unknown[]) : []) {
    if (!isObj(d) || typeof d.id !== "string" || !SERIES_ID.test(d.id) || ids.has(d.id) || typeof d.planText !== "string") continue;
    ids.add(d.id);
    out.series.push({ id: d.id, kicker: typeof d.kicker === "string" ? d.kicker.slice(0, 80) : "내 자료", planText: d.planText, secs: num(d.secs), cut: d.cut === true, usd: num(d.usd), at: num(d.at) });
  }
  if (isObj(v.shorts))
    for (const [key, m] of Object.entries(v.shorts)) {
      if (!SHORT_KEY.test(key) || !isObj(m) || typeof m.raw !== "string") continue;
      out.shorts[key] = { raw: m.raw, secs: num(m.secs), calls: num(m.calls), fix: m.fix === "patch" || m.fix === "rewrite" ? m.fix : "", errs: num(m.errs), usd: num(m.usd), model: typeof m.model === "string" ? m.model : "", at: num(m.at) };
    }
  return out;
}

interface State {
  prefs: Prefs;
  seen: Record<string, Seen>;
  made: Made;
  series: Map<string, Series>;
}

let state: State | null = null;
let version = 0;
let listening = false;
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
    if (m) out.shorts[k] = { from: "mine", raw: m.raw, made: m };
  }
  return out;
}

/** 내장 시리즈의 계획은 바뀌지 않으니 한 번만 읽는다 */
const builtPlans = new Map<string, SeriesPlan>();
function builtPlan(id: string, planText: string): SeriesPlan {
  let p = builtPlans.get(id);
  if (!p) {
    p = usablePlan(parsePlan(planText));
    builtPlans.set(id, p);
  }
  return p;
}

/** 내장 시리즈에 이 기기에서 만든 것을 얹어 시리즈 목록을 짠다 */
function build(made: Made): Map<string, Series> {
  const series = new Map<string, Series>();
  for (const b of BUILT_SERIES) {
    const plan = builtPlan(b.id, b.planText);
    const shorts: Record<number, ShortEntry> = {};
    for (const [k, v] of Object.entries(b.shorts)) shorts[Number(k)] = { from: "built", raw: v.raw, cost: v.cost, edited: v.edited };
    // 내장 시리즈에서 아직 없던 편을 이 기기에서 만들었으면 이어 붙인다
    for (let k = 1; k <= plan.shorts.length; k++) {
      const m = made.shorts[keyOf(b.id, k)];
      if (!shorts[k] && m) shorts[k] = { from: "mine", raw: m.raw, made: m };
    }
    series.set(b.id, { id: b.id, kind: "built", kicker: b.kicker, title: plan.series, plan, planText: b.planText, planShare: b.planShare, cut: false, shorts });
  }
  const ex: Series = { id: "ex", kind: "ex", kicker: "맛보기", title: "한 편짜리 맛보기", plan: null, planText: "", planShare: 0, cut: false, shorts: {} };
  SAMPLES.forEach((x, i) => {
    ex.shorts[i + 1] = { from: "ex", raw: x.raw, label: x.label, kind: x.kind, note: x.note };
  });
  series.set("ex", ex);
  for (const d of made.series) {
    if (series.has(d.id)) continue;
    const s = mineSeries(d, made.shorts);
    if (s.plan && s.plan.shorts.length) series.set(s.id, s);
  }
  return series;
}

function init(): State {
  if (state) return state;
  const has = typeof window !== "undefined";
  const made = cleanMade(has ? read("made") : null);
  state = { prefs: cleanPrefs(has ? read("prefs") : null), seen: cleanSeen(has ? read("seen") : null), made, series: build(made) };
  if (has && !listening) {
    listening = true;
    window.addEventListener("storage", onStorage);
  }
  return state;
}

/** 저장된 것을 다시 읽어 이 창의 기억을 맞춘다 (다른 탭이 그동안 바꿨을 수 있다). 다시 읽었으면 true */
function pull(s: State, key: "seen" | "made"): boolean {
  if (ahead[key]) return false; // 이 창이 저장하지 못한 것이 있으면 이 창의 기억이 더 새것이다
  const v = read(key);
  if (v === undefined) return false;
  if (key === "seen") s.seen = cleanSeen(v);
  else {
    s.made = cleanMade(v);
    s.series = build(s.made);
  }
  return true;
}

/** 다른 탭이 저장한 것을 따라간다. 설정(디자인, 속도, 소리)은 보는 중에 바뀌면 어색해서 다음에 열 때 따라간다. */
function onStorage(e: StorageEvent): void {
  if (!state) return;
  const keys: ("seen" | "made")[] = e.key == null ? ["seen", "made"] : e.key === PREFIX + "seen" ? ["seen"] : e.key === PREFIX + "made" ? ["made"] : [];
  let changed = false;
  for (const key of keys) changed = pull(state, key) || changed;
  if (changed) emit();
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
  s.prefs = cleanPrefs({ ...s.prefs, ...patch });
  write("prefs", s.prefs);
  emit();
}
export const seenOf = (sid: string, k: number): Seen | undefined => init().seen[keyOf(sid, k)];
export function markSeen(sid: string, k: number, patch: Seen): void {
  const s = init();
  pull(s, "seen");
  const key = keyOf(sid, k);
  s.seen = { ...s.seen, [key]: { ...s.seen[key], ...patch } };
  write("seen", s.seen);
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
export const sampleList = (): { k: number; label: string; kind: string; note?: string }[] => SAMPLES.map((x, i) => ({ k: i + 1, label: x.label, kind: x.kind, note: x.note }));
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

/** 다른 탭과도 겹치지 않는 새 시리즈 id (주소에 쓰이므로 소문자와 숫자만) */
const newId = (): string => "m" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36).padStart(2, "0");

/** 새 시리즈(계획)를 저장하고 그 id를 돌려준다 */
export function addSeries(def: Omit<MadeSeries, "id" | "at">): string {
  const s = init();
  pull(s, "made");
  let id = newId();
  while (s.series.has(id)) id = newId();
  const d: MadeSeries = { ...def, id, at: Date.now() };
  s.made = { series: [...s.made.series, d], shorts: s.made.shorts };
  s.series = build(s.made);
  write("made", s.made);
  emit();
  return id;
}

/** 만든 한 편을 저장한다. 내장 시리즈의 아직 없는 편을 만든 경우도 여기에 남는다. 읽지 못하던 편을 다시 만들면 그 자리를 바꾼다. */
export function addShort(sid: string, k: number, rec: Omit<MadeShort, "at">): void {
  const s = init();
  pull(s, "made");
  if (!s.series.has(sid)) return; // 만드는 사이에 지워진 시리즈
  const m: MadeShort = { ...rec, at: Date.now() };
  s.made = { series: s.made.series, shorts: { ...s.made.shorts, [keyOf(sid, k)]: m } };
  s.series = build(s.made);
  write("made", s.made);
  emit();
}

/** 내가 만든 시리즈와 그 편들, 그 편을 본 기록을 지운다 */
export function removeSeries(id: string): void {
  const s = init();
  pull(s, "made");
  const ser = s.series.get(id);
  if (!ser || ser.kind !== "mine") return;
  const mine = (key: string) => key.startsWith(id + "-");
  s.made = { series: s.made.series.filter((x) => x.id !== id), shorts: Object.fromEntries(Object.entries(s.made.shorts).filter(([key]) => !mine(key))) };
  s.series = build(s.made);
  write("made", s.made);
  pull(s, "seen");
  if (Object.keys(s.seen).some(mine)) {
    s.seen = Object.fromEntries(Object.entries(s.seen).filter(([key]) => !mine(key)));
    write("seen", s.seen);
  }
  emit();
}

/** 만든 시리즈나 편을 이 기기에 저장하지 못한 상태인지 (저장 공간이 꽉 찼거나 저장이 막힌 브라우저). 이때는 창을 닫으면 사라진다. */
export const unsavedMade = (): boolean => ahead.made;

/** 이 화면이 이 기기에 남긴 것을 모두 지운다 (저장된 것 때문에 화면이 뜨지 않을 때의 마지막 수단) */
export function resetSaved(): void {
  for (const key of KEYS) {
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch {
      /* 저장이 막힌 브라우저에는 지울 것도 없다 */
    }
    ahead[key] = false;
  }
  state = null;
  parsed.clear();
  emit();
}
