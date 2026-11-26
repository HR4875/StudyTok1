"use client";
// 모션 쇼츠 만들기: 서버의 두 API(/api/film/plan, /api/film/short)를 부르고 진행 상황을 화면에 알린다.
// 한 번에 하나만 만든다. 화면을 옮겨 다녀도 만들기는 이어지도록 상태를 화면 밖(이 파일)에 둔다.
import { useSyncExternalStore } from "react";
import { ApiError, getHealth, postStream } from "../api";
import { FILM_LIMITS, type FilmPlanResult, type FilmShortResult } from "./types";
import { addSeries, addShort, getSeries, loadShort, subscribe } from "./store";
import { planToText } from "./plan";

export interface GenBusy {
  kind: "plan" | "short";
  /** 만드는 편 (kind가 short일 때) */
  sid: string;
  k: number;
  /** 서버가 알려 준 지금 하는 일 */
  message: string;
  /** 계획 중일 때: 지금까지 정해진 편 제목 */
  titles: string[];
  /** 시작한 시각 (Date.now) */
  t0: number;
}

export interface GenError {
  kind: "plan" | "short";
  sid: string;
  k: number;
  message: string;
  code: string;
}

export interface GenState {
  /** wait: 확인 중, ok: 만들 수 있음, none: 서버에 AI 키가 없어 이미 있는 편만 볼 수 있음, down: 서버에 닿지 못함 (연결되면 다시 확인한다) */
  avail: "wait" | "ok" | "none" | "down";
  /** 예시 모드(MOCK_AI=1): AI를 부르지 않고 내장 대본으로 답한다 */
  mock: boolean;
  busy: GenBusy | null;
  error: GenError | null;
}

let gen: GenState = { avail: "wait", mock: false, busy: null, error: null };
let ctl: AbortController | null = null;
let asking = false;
let tries = 0;
let retryTimer = 0;
let watching = false;
const listeners = new Set<() => void>();
const set = (patch: Partial<GenState>) => {
  gen = { ...gen, ...patch };
  listeners.forEach((fn) => fn());
};
const setBusy = (patch: Partial<GenBusy>) => {
  if (gen.busy) set({ busy: { ...gen.busy, ...patch } });
};

export function useGen(): GenState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => gen,
    () => gen,
  );
}
export const getGen = (): GenState => gen;

/** 다시 물어볼 때까지 기다리는 시간(ms). 세 번까지만 스스로 다시 묻고, 그 뒤로는 연결이 돌아오거나 화면을 다시 볼 때 묻는다. */
const RETRY_MS = [1500, 5000, 12000];

/** 처음 한 번만: 만들던 편의 시리즈가 지워지면 요청을 멈추고, 연결이 돌아오면 서버를 다시 확인한다 */
function watch(): void {
  if (watching || typeof window === "undefined") return;
  watching = true;
  subscribe(() => {
    // 이 창이나 다른 탭에서 시리즈를 지웠다: 끝나도 둘 곳이 없는 요청은 멈추고, 그 시리즈의 오류 표시도 지운다
    const b = gen.busy;
    if (b && b.kind === "short" && !getSeries(b.sid)) stopGen();
    const e = gen.error;
    if (e && e.kind === "short" && !getSeries(e.sid)) set({ error: null });
  });
  const again = () => {
    if (gen.avail !== "down" && gen.avail !== "wait") return;
    tries = 0;
    initGen();
  };
  window.addEventListener("online", again);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) again();
  });
}

/**
 * 만들 수 있는 서버인지 확인한다 (화면이 뜰 때마다 불러도 된다: 이미 답을 얻었으면 아무것도 하지 않는다).
 * 서버에 닿지 못한 것은 키가 없는 것과 다르다. 잠깐 끊긴 것일 수 있으니 몇 번 다시 묻는다.
 */
export function initGen(): void {
  watch();
  if (asking || gen.avail === "ok" || gen.avail === "none") return;
  asking = true;
  window.clearTimeout(retryTimer);
  void getHealth().then((h) => {
    asking = false;
    if (h) {
      tries = 0;
      set({ avail: h.hasKey || h.mock ? "ok" : "none", mock: !!h.mock });
      return;
    }
    const wait = RETRY_MS[tries];
    tries += 1;
    // 첫 실패는 조용히 다시 묻고, 거듭 실패하면 닿지 못했다고 알린다
    if (tries >= 2 || wait == null) set({ avail: "down" });
    if (wait != null) retryTimer = window.setTimeout(initGen, wait);
  });
}

export function stopGen(): void {
  ctl?.abort();
}
export function clearGenError(): void {
  if (gen.error) set({ error: null });
}

/** 다시 눌러도 소용없는 오류: 만들기 자체를 닫는다 */
const DEAD = new Set(["NO_KEY", "BAD_KEY", "NO_CREDIT", "BAD_MODEL"]);

function fail(kind: "plan" | "short", sid: string, k: number, e: unknown): void {
  const err = e instanceof ApiError ? e : new ApiError("연결이 잠깐 끊겼어요. 다시 눌러 주세요", "NETWORK");
  if (err.code === "CANCELLED") {
    set({ busy: null });
    return;
  }
  set({ busy: null, error: { kind, sid, k, message: err.message, code: err.code }, ...(DEAD.has(err.code) ? { avail: "none" as const } : {}) });
}

/** 계획의 k편을 만든다. 이미 볼 수 있는 편이거나 다른 것을 만드는 중이면 아무것도 하지 않는다. 성공하면 true */
export async function makeShort(sid: string, k: number): Promise<boolean> {
  const s = getSeries(sid);
  if (gen.busy || gen.avail !== "ok" || !s || !s.plan || !s.plan.shorts[k - 1]) return false;
  // 이미 있는 편은 다시 만들지 않는다. 다만 이 기기에 남은 대본을 읽지 못하게 됐으면 그 자리에 다시 만든다.
  const have = s.shorts[k];
  if (have && (have.from !== "mine" || loadShort(sid, k)?.scenes)) return false;
  ctl = new AbortController();
  set({ busy: { kind: "short", sid, k, message: "계획한 순서대로 대본을 쓰기 시작하는 중", titles: [], t0: Date.now() }, error: null });
  try {
    const { data, usage } = await postStream<FilmShortResult>(
      "/api/film/short",
      { planText: planToText(s.plan), k },
      { signal: ctl.signal, onStatus: (message) => setBusy({ message }) },
    );
    if (!data || typeof data.raw !== "string" || !data.scenes) throw new ApiError("받은 대본을 읽지 못했어요. 다시 눌러 주세요", "BAD_OUTPUT");
    addShort(sid, k, { raw: data.raw, secs: Math.round(data.secs), calls: data.calls, fix: data.fix, errs: data.errs, usd: usage?.usd ?? 0, model: data.model });
    set({ busy: null });
    return true;
  } catch (e) {
    fail("short", sid, k, e);
    return false;
  } finally {
    ctl = null;
  }
}

/**
 * 주제나 자료로 시리즈를 계획한다. 성공하면 새 시리즈의 id를 돌려주고, 이어서 1편을 만들기 시작한다 (기다리지 않는다).
 * source는 쪽마다 [p.N] 표시를 붙인 글, label은 자료 이름(없으면 주제를 쓴다).
 */
export async function makePlan(topic: string, source: string, label: string): Promise<string | null> {
  if (gen.busy || gen.avail !== "ok") return null;
  ctl = new AbortController();
  set({ busy: { kind: "plan", sid: "", k: 0, message: "자료를 읽고 가장 쉬운 설명 순서를 고르는 중", titles: [], t0: Date.now() }, error: null });
  let id: string | null = null;
  try {
    const { data, usage } = await postStream<FilmPlanResult>(
      "/api/film/plan",
      { topic, source: source.slice(0, FILM_LIMITS.sourceChars), max: FILM_LIMITS.planDefault },
      { signal: ctl.signal, onStatus: (message) => setBusy({ message }), onFound: (titles) => setBusy({ titles, message: `${titles.length}편째 계획하는 중` }) },
    );
    if (!data || typeof data.planText !== "string" || !data.shorts) throw new ApiError("계획을 끝까지 받지 못했어요. 자료를 조금 줄이거나 다시 눌러 주세요", "BAD_OUTPUT");
    id = addSeries({ kicker: "내 자료 · " + (label || topic || "주제").slice(0, 40), planText: data.planText, secs: Math.round(data.secs), cut: data.cut, usd: usage?.usd ?? 0 });
    set({ busy: null });
  } catch (e) {
    fail("plan", "", 0, e);
  } finally {
    ctl = null;
  }
  if (id) void makeShort(id, 1);
  return id;
}
