"use client";
// 모션 쇼츠 만들기: 서버의 두 API(/api/film/plan, /api/film/short)를 부르고 진행 상황을 화면에 알린다.
// 한 번에 하나만 만든다. 화면을 옮겨 다녀도 만들기는 이어지도록 상태를 화면 밖(이 파일)에 둔다.
import { useSyncExternalStore } from "react";
import { ApiError, getHealth, postStream } from "../api";
import { FILM_LIMITS, type FilmPlanResult, type FilmShortResult } from "./types";
import { addSeries, addShort, getSeries, loadShort, subscribe } from "./store";
import { planToText } from "./plan";
import { HOST } from "./host";

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
  /** 보는 동안 다음 편을 미리 만드는 중: 사람이 직접 누른 만들기가 오면 자리를 내준다 */
  ahead?: boolean;
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
/** 이 화면을 연 뒤에 만들기가 한 번이라도 됐는지. 만들기에 허락을 묻는 곳(HOST.asks)에서는 그 뒤부터만 미리 만든다: 보는 도중에 허락 창이 뜨지 않게 */
let used = false;
/** 만들기가 실패한 뒤로는 사람이 누른 만들기가 다시 될 때까지 미리 만들지 않는다: 한도에 걸렸거나 끊긴 채로, 볼 때마다 혼자 다시 부르지 않게 */
let aheadOff = false;
/** 사람이 "그만"으로 멈춘 편 ("시리즈:편"). 그 편은 사람이 직접 누를 때까지 미리 만들지 않는다 */
const declined = new Set<string>();
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
/** 사람이 직접 누른 것을 만드는 중인지. 미리 만드는 편은 직접 누른 만들기에 자리를 내주므로 단추를 막지 않는다 */
export const blocking = (g: GenState): boolean => !!g.busy && !g.busy.ahead;

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
  // 미리 만드는 중에 화면을 닫거나 새로 열면, 다른 탭이나 새로 연 화면이 그 편을 다시 미리 만들 수 있게 적어 둔 것을 지운다
  window.addEventListener("pagehide", () => {
    const b = gen.busy;
    if (b && b.ahead) lease(b.sid + ":" + b.k, false);
  });
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
  const b = gen.busy;
  if (b && b.kind === "short") declined.add(b.sid + ":" + b.k);
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
  aheadOff = true;
  set({ busy: null, error: { kind, sid, k, message: err.message, code: err.code }, ...(DEAD.has(err.code) ? { avail: "none" as const } : {}) });
}

/**
 * 미리 만들던 편(busy.ahead)은 사람이 직접 누른 만들기에 자리를 내준다: 그 요청을 멈추고 true를 돌려준다.
 * 직접 누른 것을 만드는 중이면 false (한 번에 하나만 만든다).
 */
function makeRoom(): boolean {
  if (!gen.busy) return true;
  if (!gen.busy.ahead) return false;
  ctl?.abort();
  return true;
}

// ---------- 탭 사이 ----------
// 탭을 여러 개 열어 둔 사람: 같은 편을 탭마다 미리 만들지 않게, 미리 만들기 시작할 때 이 기기에 잠깐 적어 둔다.
const LEASE = "film.ahead";
/** 미리 만들기 한 편에 넉넉한 시간(ms). 이보다 오래된 표시는 탭이 닫혀 남은 것으로 본다 */
const LEASE_MS = 200_000;
const TAB = Math.random().toString(36).slice(2);
interface Lease {
  tab: string;
  key: string;
  until: number;
}
function readLease(): Lease | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(LEASE) || "null") as Partial<Lease> | null;
    return v && typeof v.tab === "string" && typeof v.key === "string" && typeof v.until === "number" ? (v as Lease) : null;
  } catch {
    return null; // 저장이 막힌 브라우저: 탭끼리 알릴 길이 없을 뿐이다
  }
}
/** 다른 탭이 지금 이 편을 미리 만드는 중인지 */
const leased = (key: string): boolean => {
  const v = readLease();
  return !!v && v.tab !== TAB && v.key === key && v.until > Date.now();
};
/** 이 탭이 미리 만들기 시작한 편을 적거나(on), 끝났을 때 지운다 */
function lease(key: string, on: boolean): void {
  try {
    if (on) window.localStorage.setItem(LEASE, JSON.stringify({ tab: TAB, key, until: Date.now() + LEASE_MS } satisfies Lease));
    else {
      const v = readLease();
      if (v && v.tab === TAB && v.key === key) window.localStorage.removeItem(LEASE);
    }
  } catch {
    /* 적지 못해도 만들기는 그대로 한다 */
  }
}

/**
 * 계획의 k편을 만든다. 이미 볼 수 있는 편이거나 다른 것을 만드는 중이면 아무것도 하지 않는다. 성공하면 true.
 * ahead: 사람이 누른 것이 아니라, 앞 편을 보는 동안 미리 만들어 두는 것. 다른 것을 만드는 중이면 시작하지 않고, 실패해도 알리지 않는다
 * (끝 화면과 목록에 만들기 단추가 그대로 있다). 사람이 누르지 않은 호출이라 삼가는 때가 있다: 만들기에 허락을 묻는 곳에서 아직 아무것도
 * 만들지 않았을 때, 앞선 만들기가 실패한 뒤, 사람이 그 편을 "그만"으로 멈춘 뒤, 다른 탭이 그 편을 미리 만드는 중일 때.
 */
export async function makeShort(sid: string, k: number, opts: { ahead?: boolean } = {}): Promise<boolean> {
  const s = getSeries(sid);
  if (gen.avail !== "ok" || !s || !s.plan || !s.plan.shorts[k - 1]) return false;
  // 이미 있는 편은 다시 만들지 않는다. 다만 이 기기에 남은 대본을 읽지 못하게 됐으면 그 자리에 다시 만든다.
  const have = s.shorts[k];
  if (have && (have.from !== "mine" || loadShort(sid, k)?.scenes)) return false;
  const key = sid + ":" + k;
  if (opts.ahead && ((HOST.asks && !used) || aheadOff || declined.has(key) || leased(key))) return false;
  const b = gen.busy;
  // 미리 만들던 바로 그 편을 눌렀으면 그대로 둔다
  if (b && (opts.ahead || (b.kind === "short" && b.sid === sid && b.k === k) || !makeRoom())) return false;
  const my = new AbortController();
  ctl = my;
  const busy: GenBusy = { kind: "short", sid, k, message: "계획한 순서대로 대본을 쓰기 시작하는 중", titles: [], t0: Date.now() };
  // 미리 만들기는 화면에 떠 있는 앞선 오류 안내를 지우지 않는다 (사람이 누른 것이 아니다)
  if (opts.ahead) {
    lease(key, true);
    set({ busy: { ...busy, ahead: true } });
  } else {
    declined.delete(key);
    set({ busy, error: null });
  }
  try {
    const { data, usage } = await postStream<FilmShortResult>(
      "/api/film/short",
      // ahead: 서버가 사람이 누르지 않은 요청임을 알게 한다 (하루 한도의 마지막 몫은 직접 누른 만들기에 남긴다)
      { planText: planToText(s.plan), k, ...(opts.ahead ? { ahead: true } : {}) },
      { signal: my.signal, onStatus: (message) => ctl === my && setBusy({ message }) },
    );
    if (!data || typeof data.raw !== "string" || !data.scenes) throw new ApiError("받은 대본을 읽지 못했어요. 다시 눌러 주세요", "BAD_OUTPUT");
    addShort(sid, k, { raw: data.raw, secs: Math.round(data.secs), calls: data.calls, fix: data.fix, errs: data.errs, usd: usage?.usd ?? 0, model: data.model });
    used = true;
    if (!opts.ahead) aheadOff = false;
    if (ctl === my) set({ busy: null });
    return true;
  } catch (e) {
    // 자리를 내준 요청(ctl이 이미 다른 것)은 화면의 상태를 건드리지 않는다.
    if (ctl === my) {
      if (!opts.ahead) fail("short", sid, k, e);
      else {
        // 미리 만들기의 실패는 조용히 넘긴다. 다만 멈춘 것이 아니라 실패한 것이면, 사람이 누른 만들기가 될 때까지 미리 만들기를 쉰다
        if (!(e instanceof ApiError && e.code === "CANCELLED")) aheadOff = true;
        set({ busy: null });
      }
    }
    return false;
  } finally {
    if (opts.ahead) lease(key, false);
    if (ctl === my) ctl = null;
  }
}

/**
 * 주제나 자료로 시리즈를 계획한다. 성공하면 새 시리즈의 id를 돌려주고, 이어서 1편을 만들기 시작한다 (기다리지 않는다).
 * source는 쪽마다 [p.N] 표시를 붙인 글, label은 자료 이름(없으면 주제를 쓴다).
 */
export async function makePlan(topic: string, source: string, label: string): Promise<string | null> {
  if (gen.avail !== "ok" || !makeRoom()) return null;
  const my = new AbortController();
  ctl = my;
  set({ busy: { kind: "plan", sid: "", k: 0, message: "자료를 읽고 가장 쉬운 설명 순서를 고르는 중", titles: [], t0: Date.now() }, error: null });
  let id: string | null = null;
  try {
    const { data, usage } = await postStream<FilmPlanResult>(
      "/api/film/plan",
      { topic, source: source.slice(0, FILM_LIMITS.sourceChars), max: FILM_LIMITS.planDefault },
      {
        signal: my.signal,
        onStatus: (message) => ctl === my && setBusy({ message }),
        onFound: (titles) => ctl === my && setBusy({ titles, message: `${titles.length}편째 계획하는 중` }),
      },
    );
    if (!data || typeof data.planText !== "string" || !data.shorts) throw new ApiError("계획을 끝까지 받지 못했어요. 자료를 조금 줄이거나 다시 눌러 주세요", "BAD_OUTPUT");
    id = addSeries({ kicker: "내 자료 · " + (label || topic || "주제").slice(0, 40), planText: data.planText, secs: Math.round(data.secs), cut: data.cut, usd: usage?.usd ?? 0 });
    used = true;
    aheadOff = false;
    if (ctl === my) set({ busy: null });
  } catch (e) {
    if (ctl === my) fail("plan", "", 0, e);
  } finally {
    if (ctl === my) ctl = null;
  }
  if (id) void makeShort(id, 1);
  return id;
}
