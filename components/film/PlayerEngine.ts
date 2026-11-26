"use client";
// 재생기의 움직이는 부분. 매 프레임 하는 일(그리기, 진행 막대, 시각)은 React를 거치지 않고 DOM에 바로 쓰고,
// 드물게 바뀌는 것(시작했는지, 멈췄는지, 끝났는지, 열린 메뉴)만 onView로 알린다.
import { createDirector, W, H, type FilmInfo, type Script } from "@/lib/film";
import { BRAND, getPrefs, markSeen, setPrefs, type Prefs } from "@/lib/film/store";
import { fmtT } from "./format";
import type { IconName } from "./icons";
import { blip, bufferOf, createVoice, forgetBuffer, openAudio, prepareBuffer } from "./PlayerAudio";

export type PlayerMenu = "skin" | "speed" | null;

export interface PlayerView {
  info: FilmInfo | null;
  started: boolean;
  playing: boolean;
  ended: boolean;
  /** 영상 속 질문에서 답을 기다리는 중 */
  hold: boolean;
  menu: PlayerMenu;
  /** 화면 가운데에 잠깐 뜨는 표시. n이 바뀔 때마다 다시 뜬다 */
  flash: { name: IconName; n: number } | null;
}

export const EMPTY_VIEW: PlayerView = { info: null, started: false, playing: false, ended: false, hold: false, menu: null, flash: null };

export interface PlayerEls {
  svg: SVGSVGElement;
  wrap: HTMLDivElement;
  box: HTMLDivElement;
  segs: HTMLDivElement;
  time: HTMLSpanElement;
}

export interface PlayerApi {
  play(): void;
  /** 재생 단추: 시작 전이면 시작, 아니면 멈춤과 재생을 오간다 */
  playPause(): void;
  onStage(clientX: number, clientY: number): void;
  scrubStart(e: PointerEvent): void;
  toggleMenu(kind: "skin" | "speed"): void;
  pick(change: Partial<Prefs>): void;
  toggleSound(): void;
  replay(): void;
  /** 진행 막대의 칸이 새로 그려진 뒤 부른다 */
  refreshFills(): void;
  destroy(): void;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const now = () => performance.now();

/** 표지와 정지 화면에 쓸 시각: 질문 바로 앞, 질문이 없으면 그림이 가장 많이 찬 무렵 */
export const posterTime = (info: FilmInfo): number => {
  const a = info.asks[0];
  return clamp(a ? info.beats[a.beat].t0 - 0.6 : info.dur * 0.62, 0, Math.max(0, info.dur - 0.5));
};

const loadOpts = () => {
  const p = getPrefs();
  return { skin: p.skin, speed: p.speed, interactive: true, fancy: true, brand: BRAND };
};

export function createPlayer(o: { sid: string; k: number; script: Script; els: PlayerEls; onView: (v: PlayerView) => void; onClose: () => void }): PlayerApi {
  const { sid, k, script, els } = o;
  const dir = createDirector(els.svg, { fancy: true, interactive: true });
  const voice = createVoice();
  let alive = true;
  let raf = 0;
  let info: FilmInfo | null = null;
  // t는 재생 시각(초). 재생 중에는 baseT와 baseNow에서 계산한다
  let t = 0;
  let baseT = 0;
  let baseNow = 0;
  let started = false;
  let playing = false;
  let ended = false;
  let hold = false;
  let userPaused = false;
  let answers: Record<number, number> = {};
  let askRight: boolean | null = null;
  let menu: PlayerMenu = null;
  let flash: PlayerView["flash"] = null;
  // 대본을 싣는 중에는 입력을 받지 않는다 (엔진의 시간표가 반쯤 바뀐 상태라서)
  let loading = true;
  let loadSeq = 0;
  let resumeAfter = false;
  let waitKey = "";
  let fills: HTMLElement[] = [];
  let endScrub: (() => void) | null = null;
  let view = EMPTY_VIEW;

  const emit = () => {
    const v: PlayerView = { info, started, playing, ended, hold, menu, flash };
    if ((Object.keys(v) as (keyof PlayerView)[]).every((key) => v[key] === view[key])) return;
    view = v;
    if (alive) o.onView(v);
  };

  // ---------- 그리기 ----------
  function fit() {
    const r = els.wrap.getBoundingClientRect();
    const w = Math.max(120, Math.min(r.width - 16, (r.height * 9) / 16));
    els.box.style.width = w + "px";
    els.box.style.height = (w * 16) / 9 + "px";
  }
  function paint() {
    if (!info) return;
    const B = info.beats;
    const at = started ? t : 0;
    if (fills.length === B.length) for (let i = 0; i < B.length; i++) fills[i].style.width = (clamp((at - B[i].t0) / B[i].dur, 0, 1) * 100).toFixed(1) + "%";
    const text = fmtT(at) + " / " + fmtT(info.dur);
    if (els.time.textContent !== text) els.time.textContent = text;
    els.segs.setAttribute("aria-valuenow", String(Math.round(at)));
    els.segs.setAttribute("aria-valuetext", text);
  }
  const draw = () => {
    if (!info) return;
    dir.seek(Math.min(t, info.dur - 0.001));
    paint();
  };
  const waiting = () => {
    const p = info ? dir.pendingAsk(t) : null;
    return !!(p && t >= p.hold - 1e-6);
  };

  // ---------- 소리 ----------
  const audioKey = () => {
    const p = getPrefs();
    return `${sid}-${k}|${p.skin}|${p.speed}`;
  };
  function ensureAudio() {
    if (!getPrefs().sound || !info) return;
    if (!openAudio()) return;
    const key = audioKey();
    if (bufferOf(key) || waitKey === key) return;
    waitKey = key;
    void prepareBuffer(key, dir.score(), info.dur).then(() => {
      if (waitKey === key) waitKey = "";
      if (alive && playing && audioKey() === key) startAudio();
    });
  }
  function startAudio() {
    voice.stop();
    const buf = bufferOf(audioKey());
    if (!getPrefs().sound || !buf || !playing) return;
    const off = baseT + (now() - baseNow) / 1000;
    if (off >= buf.duration - 0.05) return;
    voice.start(buf, off);
  }

  // ---------- 재생 ----------
  function halt() {
    playing = false;
    cancelAnimationFrame(raf);
    raf = 0;
  }
  function pause(byUser: boolean) {
    halt();
    voice.stop();
    if (byUser) userPaused = true;
    emit();
  }
  function play() {
    if (!info || !alive || loading) return;
    if (ended || t >= info.dur - 0.02) {
      t = 0;
      ended = false;
    }
    menu = null;
    started = true;
    userPaused = false;
    if (waiting()) {
      hold = true;
      halt();
      draw();
      emit();
      return;
    }
    hold = false;
    playing = true;
    baseT = t;
    baseNow = now();
    ensureAudio();
    startAudio();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
    emit();
  }
  function tick() {
    if (!playing || !info) return;
    const prev = t;
    const nt = baseT + (now() - baseNow) / 1000;
    for (const a of info.asks) {
      if (answers[a.n] == null && prev <= a.hold && nt >= a.hold) {
        t = a.hold;
        draw();
        hold = true;
        pause(false);
        return;
      }
    }
    if (nt >= info.dur) {
      t = info.dur;
      draw();
      finish(true);
      return;
    }
    t = nt;
    draw();
    raf = requestAnimationFrame(tick);
  }
  function showFlash(name: IconName) {
    flash = { name, n: (flash ? flash.n : 0) + 1 };
    emit();
  }
  function toggle() {
    if (playing) {
      pause(true);
      showFlash("pause");
    } else if (!hold || !waiting()) {
      play();
      showFlash("play");
    }
  }
  function seekTo(nt: number) {
    if (!info) return;
    t = clamp(nt, 0, info.dur);
    ended = false;
    hold = false;
    started = true;
    if (t >= info.dur - 0.01) {
      halt();
      draw();
      finish(false);
      return;
    }
    if (waiting()) {
      hold = true;
      draw();
      pause(false);
      return;
    }
    if (!userPaused) play();
    else {
      halt();
      voice.stop();
      draw();
      emit();
    }
  }
  function jump(d: number) {
    if (!info) return;
    const B = info.beats;
    let i = 0;
    for (let j = 0; j < B.length; j++) if (B[j].t0 <= t + 1e-3) i = j;
    showFlash(d < 0 ? "prev" : "next");
    seekTo(d < 0 ? (t - B[i].t0 > 1 ? B[i].t0 : B[Math.max(0, i - 1)].t0) : i >= B.length - 1 ? info.dur : B[i + 1].t0);
  }
  function answerAsk(hit: { n: number; choice: number }) {
    const r = dir.answer(hit.n, hit.choice);
    if (!r) return;
    answers[hit.n] = hit.choice;
    if (askRight == null) askRight = r.correct;
    t = Math.max(t, r.resume);
    hold = false;
    userPaused = false;
    play();
    blip(r.correct);
  }
  function finish(natural: boolean) {
    if (!info) return;
    halt();
    // 끝까지 흘러간 배경음은 마지막 울림을 남겨 두고, 건너뛰어 끝낸 경우만 끊는다
    if (!natural) voice.stop();
    ended = true;
    hold = false;
    const last = info.beats[info.beats.length - 1];
    dir.seek(Math.max(0, last.t0 + last.dur - 0.5)); // 끝 화면 뒤에는 다 그려진 그림이 남는다
    paint();
    markSeen(sid, k, { done: true, ask: askRight, at: Date.now() });
    emit();
  }

  // ---------- 입력 ----------
  function onStage(clientX: number, clientY: number) {
    if (!info || loading) return;
    if (menu) {
      menu = null;
      emit();
      return;
    }
    if (!started) {
      play();
      return;
    }
    const r = els.box.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * W;
    const y = ((clientY - r.top) / r.height) * H;
    const hit = ended ? null : dir.hitAsk(t, x, y);
    if (hit) {
      answerAsk(hit);
      return;
    }
    if (x < W * 0.26) {
      jump(-1);
      return;
    }
    if (hold && waiting()) return; // 질문은 답을 기다린다
    if (x > W * 0.74) {
      jump(1);
      return;
    }
    toggle();
  }
  function scrubStart(e: PointerEvent) {
    if (!info || loading || endScrub) return;
    e.preventDefault();
    const segs = els.segs;
    try {
      segs.setPointerCapture(e.pointerId);
    } catch {
      /* 포인터를 붙잡지 못해도 끌기는 된다 */
    }
    const was = playing || (started && !userPaused && !ended) || !started;
    halt();
    voice.stop();
    const mv = (ev: PointerEvent) => {
      if (!info) return;
      const r = segs.getBoundingClientRect();
      t = clamp((ev.clientX - r.left) / r.width, 0, 1) * info.dur;
      started = true;
      ended = false;
      hold = false;
      draw();
      emit();
    };
    const off = () => {
      segs.removeEventListener("pointermove", mv);
      segs.removeEventListener("pointerup", up);
      segs.removeEventListener("pointercancel", up);
      endScrub = null;
    };
    const up = () => {
      off();
      userPaused = !was;
      seekTo(t);
    };
    segs.addEventListener("pointermove", mv);
    segs.addEventListener("pointerup", up);
    segs.addEventListener("pointercancel", up);
    endScrub = off;
    mv(e);
  }
  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    if (e.key === "Escape") {
      if (menu) {
        menu = null;
        emit();
      } else o.onClose();
      return;
    }
    if (!info || loading) return;
    const tag = e.target instanceof HTMLElement ? e.target.tagName : "";
    // 단추와 링크는 제 할 일을 한다
    if ((tag === "BUTTON" || tag === "A") && (e.key === " " || e.key === "Enter")) return;
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      if (!started) play();
      else toggle();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      jump(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (!(hold && waiting())) jump(1);
    } else if (/^[1-4]$/.test(e.key) && !ended) {
      const p = dir.pendingAsk(t);
      const c = Number(e.key);
      if (p && c <= p.rects.length) answerAsk({ n: p.n, choice: c - 1 });
    }
  }
  function onVis() {
    if (document.hidden && playing) pause(false);
  }

  // ---------- 디자인과 속도 ----------
  /** 대본을 다시 싣는다. 자리는 대본 자체의 시계로 지키고, 이미 한 답은 다시 넣는다 */
  async function reload(change: Partial<Prefs>): Promise<boolean> {
    // 처음 싣기가 끝나기 전에 고른 것도 받는다 (그 싣기는 버려진다)
    const was = playing || resumeAfter;
    const inner = info ? t * info.speed : 0;
    const seq = ++loadSeq;
    resumeAfter = was;
    loading = true;
    halt();
    voice.stop();
    if (Object.keys(change).length) setPrefs(change);
    emit();
    let ni: FilmInfo;
    try {
      ni = await dir.load(script, loadOpts());
    } catch {
      if (alive && seq === loadSeq) loading = false;
      return false;
    }
    if (!alive || seq !== loadSeq) return false;
    loading = false;
    resumeAfter = false;
    info = ni;
    for (const [n, c] of Object.entries(answers)) dir.answer(Number(n), c);
    t = clamp(inner / ni.speed, 0, ni.dur);
    if (!started) {
      dir.seek(posterTime(ni));
      paint();
    } else if (was) play();
    else {
      draw();
      if (waiting()) hold = true;
    }
    emit();
    return true;
  }

  // ---------- 시작 ----------
  els.segs.setAttribute("aria-valuenow", "0");
  const ro = new ResizeObserver(fit);
  ro.observe(els.wrap);
  fit();
  document.addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", onVis);
  const first = ++loadSeq;
  dir
    .load(script, loadOpts())
    .then((ni) => {
      if (!alive || first !== loadSeq) return;
      loading = false;
      info = ni;
      dir.seek(posterTime(ni));
      emit();
    })
    .catch(() => {
      /* 싣지 못한 대본은 표지만 남는다 */
    });

  return {
    play,
    playPause() {
      if (!started) play();
      else toggle();
    },
    onStage,
    scrubStart,
    toggleMenu(kind) {
      menu = menu === kind ? null : kind;
      emit();
    },
    pick(change) {
      menu = null;
      emit();
      void reload(change);
    },
    toggleSound() {
      const on = !getPrefs().sound;
      setPrefs({ sound: on });
      if (on) {
        ensureAudio();
        if (playing) startAudio();
      } else voice.stop();
    },
    replay() {
      t = 0;
      ended = false;
      answers = {};
      askRight = null;
      void reload({}).then((ok) => {
        if (ok) play();
      });
    },
    refreshFills() {
      fills = Array.from(els.segs.querySelectorAll<HTMLElement>(":scope > .seg > i"));
      paint();
    },
    destroy() {
      alive = false;
      halt();
      voice.stop();
      if (waitKey) forgetBuffer(waitKey);
      endScrub?.();
      ro.disconnect();
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
    },
  };
}
